import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TrainingFeedback = Database["public"]["Tables"]["training_feedbacks"]["Row"];
export type TrainingFeedbackInsert = Database["public"]["Tables"]["training_feedbacks"]["Insert"];

export interface FeedbackTrainingOption {
  id: string;
  name: string;
  startDate: string | null;
}

/** Retours libres d'une session, ou d'un seul participant si participantId est donné. */
export async function fetchTrainingFeedbacks(trainingId: string, participantId?: string): Promise<TrainingFeedback[]> {
  let q = supabase.from("training_feedbacks").select("*").eq("training_id", trainingId);
  if (participantId) q = q.eq("participant_id", participantId);
  const { data, error } = await q.order("received_at", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertTrainingFeedback(row: TrainingFeedbackInsert): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("training_feedbacks").insert({ ...row, created_by: auth.user?.id ?? null });
  if (error) throw error;
}

export async function deleteTrainingFeedback(id: string): Promise<void> {
  const { error } = await supabase.from("training_feedbacks").delete().eq("id", id);
  if (error) throw error;
}

/** Sessions qui ont des retours à froid soumis ou des retours libres, pour les proposer à l'analyse. */
export async function fetchTrainingsWithFeedback(): Promise<FeedbackTrainingOption[]> {
  const [cold, free] = await Promise.all([
    supabase.from("participant_cold_evaluations").select("trainings(id, training_name, start_date)").eq("etat", "soumis").limit(1000),
    supabase.from("training_feedbacks").select("trainings(id, training_name, start_date)").limit(1000),
  ]);
  if (cold.error) throw cold.error;
  if (free.error) throw free.error;
  const map = new Map<string, FeedbackTrainingOption>();
  for (const row of [...(cold.data || []), ...(free.data || [])]) {
    const t = row.trainings as { id: string; training_name: string; start_date: string | null } | null;
    if (t && !map.has(t.id)) map.set(t.id, { id: t.id, name: t.training_name, startDate: t.start_date });
  }
  return [...map.values()];
}
