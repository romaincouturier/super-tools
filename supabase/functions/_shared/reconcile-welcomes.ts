/**
 * Rattrapage des convocations (welcome) non programmées.
 *
 * Cas couvert : une session est créée sans date de début (intra gagné en
 * opportunité), des participants sont ajoutés — aucun `scheduled_emails`
 * de type "welcome" n'est créé. Quand la date est renseignée ensuite,
 * rien ne rattrape la programmation et la convocation n'est jamais envoyée.
 *
 * Cette réconciliation tourne à chaque passage du cron des emails programmés :
 * pour toute session future, non annulée et non e-learning, chaque participant
 * doit avoir une convocation soit déjà envoyée, soit en file d'attente.
 */

import { fetchWorkingDays, subtractWorkingDays } from "./working-days.ts";

const WELCOME_OFFSET_WORKING_DAYS = 7;


export interface ReconcileResult {
  checkedTrainings: number;
  scheduled: number;
  errors: number;
}

// deno-lint-ignore no-explicit-any
export async function reconcileMissingWelcomes(supabase: any): Promise<ReconcileResult> {
  const result: ReconcileResult = { checkedTrainings: 0, scheduled: 0, errors: 0 };
  const today = new Date().toISOString().split("T")[0];

  const { data: trainings, error: trainingsError } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, format_formation, is_cancelled, is_free")
    .gte("start_date", today)
    .not("start_date", "is", null);

  if (trainingsError) {
    console.error("[reconcile-welcomes] trainings fetch:", trainingsError);
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
      .select("id, email")
      .eq("training_id", training.id);
    if (!participants || participants.length === 0) continue;

    // deno-lint-ignore no-explicit-any
    const ids = participants.map((p: any) => p.id);

    const [{ data: queued }, { data: sent }] = await Promise.all([
      supabase
        .from("scheduled_emails")
        .select("participant_id")
        .eq("email_type", "welcome")
        .in("participant_id", ids),
      supabase
        .from("sent_emails_log")
        .select("participant_id")
        .eq("email_type", "welcome")
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
    const welcomeDate = subtractWorkingDays(startDate, WELCOME_OFFSET_WORKING_DAYS, workingDays);
    // Si la date J-7 est déjà passée, on programme immédiatement : mieux vaut
    // une convocation tardive que pas de convocation.
    const scheduledFor = welcomeDate > now
      ? `${welcomeDate.toISOString().split("T")[0]}T09:00:00`
      : now.toISOString();

    const rows = missing.map((p) => ({
      training_id: training.id,
      participant_id: p.id,
      email_type: "welcome",
      scheduled_for: scheduledFor,
      status: "pending",
    }));

    const { error: insertError } = await supabase.from("scheduled_emails").insert(rows);
    if (insertError) {
      console.error(
        `[reconcile-welcomes] insert failed for training ${training.id}:`,
        insertError,
      );
      result.errors++;
      continue;
    }

    result.scheduled += rows.length;
    console.log(
      `[reconcile-welcomes] ${rows.length} convocation(s) programmée(s) le ${scheduledFor} pour "${training.training_name}" (${training.start_date})`,
    );
  }

  return result;
}
