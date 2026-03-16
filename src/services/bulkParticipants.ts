import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/stringUtils";
import { getEmailMode } from "@/lib/emailScheduling";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { format, parseISO } from "date-fns";
import { getErrorMessage } from "@/lib/error-utils";
import type { ParsedParticipant } from "@/hooks/useParticipantParser";
import { sendParticipantWelcomeEmail, generateWoocommerceCoupon, sendElearningAccess } from "@/services/participants";

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

  const { data, error } = await supabase
    .from("training_participants")
    .insert(toInsert)
    .select();

  let duplicateWarning = false;
  if (error) {
    if (error.code === "23505") {
      duplicateWarning = true;
    } else {
      throw new Error(getErrorMessage(error));
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
): Promise<void> {
  for (const participant of participants) {
    try {
      await sendParticipantWelcomeEmail(participant.id, trainingId);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: unknown) {
      console.error("Failed to send welcome email to:", participant.email, getErrorMessage(error));
    }
  }
}

export async function sendElearningAccessToBatch(
  participants: InsertedParticipant[],
  trainingId: string,
): Promise<void> {
  for (const participant of participants) {
    try {
      let couponCode: string | undefined;
      try {
        const result = await generateWoocommerceCoupon(participant.id, trainingId);
        if (result.couponCode) {
          couponCode = result.couponCode;
        }
      } catch (error: unknown) {
        console.error("Failed to generate coupon for:", participant.email, getErrorMessage(error));
      }

      await sendElearningAccess(participant.id, trainingId, couponCode);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: unknown) {
      console.error("Failed to send e-learning access email to:", participant.email, getErrorMessage(error));
    }
  }
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
        status: "pending",
      }));

      await supabase.from("scheduled_emails").insert(scheduledEmails);
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
