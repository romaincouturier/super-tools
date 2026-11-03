import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/stringUtils";
import { getEmailMode } from "@/lib/emailScheduling";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { format, parseISO } from "date-fns";
import { getErrorMessage } from "@/lib/error-utils";
import { scheduleEmailsBulk } from "@/services/activityLog";
import type { ParsedParticipant } from "@/hooks/useParticipantParser";
import { sendParticipantWelcomeEmail, sendLearnerAccessEmail } from "@/services/participants";

interface InsertedParticipant {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  needs_survey_token: string;
  sponsor_email: string | null;
}

export interface BulkAddResult {
  insertedCount: number;
  statusMessage: string;
  duplicateWarning: boolean;
}

export async function insertParticipantsWithQuestionnaires(
  parsedParticipants: ParsedParticipant[],
  trainingId: string,
  trainingStartDate: string | undefined,
): Promise<{ data: InsertedParticipant[] | null; status: string; sendWelcomeNow: boolean; duplicateWarning: boolean }> {
  const { status, sendWelcomeNow } = getEmailMode(trainingStartDate);

  const toInsert = parsedParticipants.map((p) => ({
    training_id: trainingId,
    email: p.email,
    first_name: capitalizeName(p.firstName || "") || null,
    last_name: capitalizeName(p.lastName || "") || null,
    company: p.company || null,
    needs_survey_token: crypto.randomUUID(),
    needs_survey_status: status,
    sponsor_first_name: capitalizeName(p.sponsorFirstName || "") || null,
    sponsor_last_name: capitalizeName(p.sponsorLastName || "") || null,
    sponsor_email: p.sponsorEmail || null,
  }));

  // Un seul doublon rejetait tout le lot : on dédoublonne la liste et on écarte les inscrits existants.
  const { data: existing, error: existingError } = await supabase
    .from("training_participants")
    .select("email")
    .eq("training_id", trainingId);
  if (existingError) throw new Error(getErrorMessage(existingError));
  const seen = new Set((existing || []).map((r: { email: string | null }) => (r.email || "").trim().toLowerCase()));
  const unique = toInsert.filter((row) => {
    const key = (row.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let duplicateWarning = unique.length < toInsert.length;

  const data: InsertedParticipant[] = [];
  const CHUNK = 50;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data: rows, error } = await supabase.from("training_participants").insert(chunk).select();
    if (!error) {
      data.push(...((rows || []) as InsertedParticipant[]));
      continue;
    }
    if (error.code !== "23505") throw new Error(getErrorMessage(error));
    duplicateWarning = true;
    for (const row of chunk) {
      const { data: one, error: oneError } = await supabase.from("training_participants").insert(row).select();
      if (oneError) {
        if (oneError.code === "23505") continue;
        throw new Error(getErrorMessage(oneError));
      }
      data.push(...((one || []) as InsertedParticipant[]));
    }
  }

  // Create questionnaire_besoins records immediately so links work from day 1
  if (data && data.length > 0) {
    try {
      const questionnaireRecords = data.map((p: InsertedParticipant) => ({
        participant_id: p.id,
        training_id: trainingId,
        token: p.needs_survey_token,
        etat: "non_envoye",
        email: p.email,
        prenom: p.first_name,
        nom: p.last_name,
        societe: p.company,
      }));
      await supabase.from("questionnaire_besoins").insert(questionnaireRecords);
    } catch (error: unknown) {
      console.warn("Failed to pre-create questionnaire records:", getErrorMessage(error));
    }
  }

  return { data, status, sendWelcomeNow, duplicateWarning };
}

export async function sendWelcomeEmailsToBatch(
  participants: InsertedParticipant[],
  trainingId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  let completed = 0;
  for (const participant of participants) {
    try {
      await sendParticipantWelcomeEmail(participant.id, trainingId);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: unknown) {
      console.error("Failed to send welcome email to:", participant.email, getErrorMessage(error));
    } finally {
      completed += 1;
      onProgress?.(completed, participants.length);
    }
  }
}

export async function sendElearningAccessToBatch(
  participants: InsertedParticipant[],
  trainingId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ email: string; message: string }[]> {
  let completed = 0;
  const failures: { email: string; message: string }[] = [];
  for (const participant of participants) {
    try {
      // Même email d'accès que l'ajout unitaire (W12) : le mode WooCommerce
      // n'est plus une voie d'accès.
      await sendLearnerAccessEmail(participant.email, trainingId);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: unknown) {
      console.error("Failed to send e-learning access email to:", participant.email, getErrorMessage(error));
      failures.push({ email: participant.email, message: getErrorMessage(error) });
    } finally {
      completed += 1;
      onProgress?.(completed, participants.length);
    }
  }
  return failures;
}

export async function scheduleNeedsSurveyEmails(
  participants: InsertedParticipant[],
  trainingId: string,
  trainingStartDate: string,
): Promise<boolean> {
  try {
    const [workingDays, needsSurveyDelay] = await Promise.all([
      fetchWorkingDays(supabase),
      fetchNeedsSurveyDelay(supabase),
    ]);

    const startDate = parseISO(trainingStartDate);
    const scheduledDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDays);

    if (scheduledDate > new Date()) {
      const scheduledEmails = participants.map((participant) => ({
        training_id: trainingId,
        participant_id: participant.id,
        email_type: "needs_survey",
        scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
      }));

      await scheduleEmailsBulk(scheduledEmails);
      return false; // not skipped
    }
    return true; // skipped
  } catch (error: unknown) {
    console.error("Failed to schedule needs survey emails:", getErrorMessage(error));
    return false;
  }
}

export async function logBulkAddActivity(
  participants: InsertedParticipant[],
  trainingId: string,
  isInterEntreprise: boolean,
): Promise<void> {
  // Bulk insert activity logs — uses raw supabase for batch efficiency
  const logInserts = participants.map((p) => ({
    action_type: "participant_added",
    recipient_email: p.email,
    details: {
      training_id: trainingId,
      participant_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
      company: p.company || null,
      bulk_add: true,
      has_sponsor: isInterEntreprise && !!p.sponsor_email,
    },
  }));
  await supabase.from("activity_logs").insert(logInserts);
}

export function buildStatusMessage(
  status: string,
  sendWelcomeNow: boolean,
  needsSurveySkipped: boolean,
): string {
  if (status === "non_envoye") {
    return "Formation passée — aucun email programmé.";
  }
  if (status === "manuel") {
    return "Mode manuel activé (formation proche).";
  }
  if ((status === "accueil_envoye" || sendWelcomeNow) && needsSurveySkipped) {
    return "Mails d'accueil envoyés. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
  }
  if (status === "accueil_envoye" || sendWelcomeNow) {
    return "Mails d'accueil envoyés, recueil des besoins programmé.";
  }
  if (needsSurveySkipped) {
    return "⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
  }
  return "Recueil des besoins programmé.";
}
