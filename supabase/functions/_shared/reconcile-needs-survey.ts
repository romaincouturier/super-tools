/**
 * Rattrapage des recueils de besoins (needs_survey) non programmés.
 *
 * Cas couvert : un participant est créé par un chemin qui n'a pas programmé
 * l'email de recueil des besoins (import, ajout historique, session sans date
 * au moment de l'inscription). Personne ne rattrape la programmation et le
 * participant ne reçoit jamais son questionnaire.
 *
 * Règle : pour toute session future, non annulée, non gratuite et non
 * e-learning, chaque participant doit avoir un recueil de besoins soit déjà
 * envoyé, soit en file d'attente.
 */

import { fetchWorkingDays, subtractWorkingDays } from "./working-days.ts";

const SURVEY_OFFSET_WORKING_DAYS = 7;

export interface ReconcileResult {
  checkedTrainings: number;
  scheduled: number;
  errors: number;
}

// deno-lint-ignore no-explicit-any
export async function reconcileMissingNeedsSurveys(supabase: any): Promise<ReconcileResult> {
  const result: ReconcileResult = { checkedTrainings: 0, scheduled: 0, errors: 0 };
  const today = new Date().toISOString().split("T")[0];

  const { data: trainings, error: trainingsError } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, format_formation, is_cancelled, is_free")
    .gte("start_date", today)
    .not("start_date", "is", null);

  if (trainingsError) {
    console.error("[reconcile-needs-survey] trainings fetch:", trainingsError);
    return { ...result, errors: 1 };
  }

  const eligible = (trainings || []).filter(
    // deno-lint-ignore no-explicit-any
    (t: any) => !t.is_cancelled && !t.is_free && t.format_formation !== "e_learning",
  );
  if (eligible.length === 0) return result;

  let workingDays: boolean[];
  try {
    workingDays = await fetchWorkingDays(supabase);
  } catch {
    workingDays = [false, true, true, true, true, true, false];
  }

  const now = new Date();

  // deno-lint-ignore no-explicit-any
  for (const training of eligible as any[]) {
    result.checkedTrainings++;

    const { data: participants } = await supabase
      .from("training_participants")
      .select("id")
      .eq("training_id", training.id);
    if (!participants || participants.length === 0) continue;

    // deno-lint-ignore no-explicit-any
    const ids = (participants as any[]).map((p) => p.id);

    const [{ data: queued }, { data: sent }] = await Promise.all([
      supabase
        .from("scheduled_emails")
        .select("participant_id")
        .eq("email_type", "needs_survey")
        .in("participant_id", ids),
      supabase
        .from("sent_emails_log")
        .select("participant_id")
        .eq("email_type", "needs_survey")
        .in("participant_id", ids),
    ]);

    const covered = new Set<string>([
      // deno-lint-ignore no-explicit-any
      ...((queued || []) as any[]).map((r) => r.participant_id),
      // deno-lint-ignore no-explicit-any
      ...((sent || []) as any[]).map((r) => r.participant_id),
    ]);

    // deno-lint-ignore no-explicit-any
    const missing = (participants as any[]).filter((p) => !covered.has(p.id));
    if (missing.length === 0) continue;

    const startDate = new Date(`${training.start_date}T00:00:00`);
    const surveyDate = subtractWorkingDays(startDate, SURVEY_OFFSET_WORKING_DAYS, workingDays);
    const scheduledFor = surveyDate > now
      ? `${surveyDate.toISOString().split("T")[0]}T09:00:00`
      : now.toISOString();

    const rows = missing.map((p) => ({
      training_id: training.id,
      participant_id: p.id,
      email_type: "needs_survey",
      scheduled_for: scheduledFor,
      status: "pending",
    }));

    const { error: insertError } = await supabase.from("scheduled_emails").insert(rows);
    if (insertError) {
      console.error(
        `[reconcile-needs-survey] insert failed for training ${training.id}:`,
        insertError,
      );
      result.errors++;
      continue;
    }

    result.scheduled += rows.length;
    console.log(
      `[reconcile-needs-survey] ${rows.length} recueil(s) de besoins programmé(s) le ${scheduledFor} pour "${training.training_name}" (${training.start_date})`,
    );
  }

  return result;
}
