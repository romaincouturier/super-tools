import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/stringUtils";
import { getEmailMode } from "@/lib/emailScheduling";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { format, parseISO } from "date-fns";
import { getErrorMessage } from "@/lib/error-utils";
import { scheduleEmailsBulk } from "@/services/activityLog";
import type { ParsedParticipant } from "@/hooks/useParticipantParser";
import { sendParticipantWelcomeEmail } from "@/services/participants";

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

export interface BulkFormula {
  id: string;
  name: string;
  coaching_sessions_count?: number | null;
}

/** Mêmes colonnes que l'ajout unitaire : formule, et coaching sur 1 an si la formule en inclut. */
export function formulaColumns(formula: BulkFormula | null | undefined, now: Date = new Date()): Record<string, unknown> {
  if (!formula) return {};
  const coaching = formula.coaching_sessions_count || 0;
  const deadline = new Date(now);
  deadline.setFullYear(deadline.getFullYear() + 1);
  return {
    formula: formula.name || null,
    formula_id: formula.id,
    ...(coaching > 0 && {
      coaching_sessions_total: coaching,
      coaching_sessions_completed: 0,
      coaching_deadline: format(deadline, "yyyy-MM-dd"),
    }),
  };
}

export async function insertParticipantsWithQuestionnaires(
  parsedParticipants: ParsedParticipant[],
  trainingId: string,
  trainingStartDate: string | undefined,
  formulaFor?: (email: string) => BulkFormula | null | undefined,
): Promise<{ data: InsertedParticipant[] | null; status: string; sendWelcomeNow: boolean; duplicateWarning: boolean }> {
  const { status, sendWelcomeNow } = getEmailMode(trainingStartDate);

  const toInsert = parsedParticipants.map((p) => ({
    ...formulaColumns(formulaFor?.(p.email)),
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

export type ElearningAccessBatchReport = {
  /** Comptes créés pendant l'envoi (mail « Créez votre mot de passe »). */
  created: number;
  /** Comptes avec mot de passe : mail « Votre accès à la formation est ouvert ». */
  confirmed: number;
  /** Comptes existants sans mot de passe : mail « Créez votre mot de passe ». */
  passwordInvites: number;
  failures: { email: string; message: string }[];
};

/**
 * Confie les emails d'accès du lot au serveur : l'envoi continue même si la page est fermée.
 * Le serveur choisit, par personne, création de mot de passe ou accès ouvert.
 */
export async function enqueueElearningAccessBatch(
  participants: InsertedParticipant[],
  trainingId: string,
): Promise<{ batchId: string; total: number }> {
  const { data, error } = await supabase.functions.invoke("queue-learner-access-emails", {
    body: { action: "enqueue", trainingId, emails: participants.map((p) => p.email) },
  });
  if (error) throw error;
  if (!data?.batchId) throw new Error("Les emails d’accès n’ont pas pu être programmés.");
  return { batchId: data.batchId, total: data.total };
}

export type ElearningAccessBatchStatus = ElearningAccessBatchReport & { total: number; completed: number; finished: boolean };

export async function fetchElearningAccessBatchStatus(batchId: string): Promise<ElearningAccessBatchStatus> {
  const { data, error } = await supabase.functions.invoke("queue-learner-access-emails", {
    body: { action: "status", batchId },
  });
  if (error) throw error;
  return data as ElearningAccessBatchStatus;
}

/** Suit le lot jusqu'à la fin (tant que l'app reste ouverte) et rend le bilan final. */
export async function watchElearningAccessBatch(
  batchId: string,
  onProgress?: (status: ElearningAccessBatchStatus) => void,
  intervalMs = 5000,
): Promise<ElearningAccessBatchStatus> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const status = await fetchElearningAccessBatchStatus(batchId);
      onProgress?.(status);
      if (status.finished) return status;
    } catch (error: unknown) {
      console.error("Suivi des emails d’accès indisponible :", getErrorMessage(error));
    }
  }
}

/** Bilan lisible des emails d'accès d'un ajout en lot. */
export function buildAccessReportMessage(report: Pick<ElearningAccessBatchReport, "created" | "confirmed" | "passwordInvites">): string {
  const parts: string[] = [];
  if (report.created) parts.push(`${report.created} compte${report.created > 1 ? "s" : ""} créé${report.created > 1 ? "s" : ""}`);
  if (report.confirmed) parts.push(`${report.confirmed} accès confirmé${report.confirmed > 1 ? "s" : ""}`);
  if (report.passwordInvites) parts.push(`${report.passwordInvites} invitation${report.passwordInvites > 1 ? "s" : ""} à créer le mot de passe`);
  return parts.length ? `Emails d’accès : ${parts.join(", ")}.` : "";
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
