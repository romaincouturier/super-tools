import { supabase } from "@/integrations/supabase/client";

const COLD_TYPES = ["cold_evaluation", "cold_evaluation_reminder", "participant_cold_evaluation", "participant_cold_evaluation_reminder"];

/** Sponsor and participant cold evaluations, plus pending sends blocked by an error. */
export async function fetchColdEvaluationData(trainingId?: string) {
  const db = supabase as any;
  let sq = db.from("sponsor_cold_evaluations").select("*, trainings(training_name)").order("date_envoi", { ascending: false }).limit(300);
  let pq = db.from("participant_cold_evaluations").select("*, trainings(training_name)").order("date_envoi", { ascending: false }).limit(300);
  let bq = db
    .from("scheduled_emails")
    .select("id, training_id, email_type, error_message, trainings(training_name)")
    .eq("status", "pending")
    .in("email_type", COLD_TYPES)
    .not("error_message", "is", null);
  if (trainingId) {
    sq = sq.eq("training_id", trainingId);
    pq = pq.eq("training_id", trainingId);
    bq = bq.eq("training_id", trainingId);
  }
  const [{ data: s }, { data: p }, { data: b }] = await Promise.all([sq, pq, bq]);
  return { s: s || [], p: p || [], b: b || [] };
}

export async function insertColdEvaluationImprovement(row: Record<string, unknown>) {
  return (supabase as any).from("improvements").insert(row);
}
