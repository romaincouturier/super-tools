import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TrainingFeedback = Database["public"]["Tables"]["training_feedbacks"]["Row"];
export type TrainingFeedbackInsert = Database["public"]["Tables"]["training_feedbacks"]["Insert"];

export const FEEDBACK_SOURCE_LABELS: Record<string, string> = {
  email: "Email",
  telephone: "Téléphone",
  oral: "Oral",
  autre: "Autre",
};

export const FEEDBACK_ROLE_LABELS: Record<string, string> = {
  participant: "Participant",
  commanditaire: "Commanditaire",
  autre: "Autre",
};

/** Retours libres d'une session, ou d'un seul participant si participantId est donné. */
export function useTrainingFeedbacks(trainingId: string, participantId?: string) {
  return useQuery({
    queryKey: ["training-feedbacks", trainingId, participantId ?? null],
    queryFn: async () => {
      let q = supabase.from("training_feedbacks").select("*").eq("training_id", trainingId);
      if (participantId) q = q.eq("participant_id", participantId);
      const { data, error } = await q.order("received_at", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!trainingId,
  });
}

export function useSaveTrainingFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TrainingFeedbackInsert) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("training_feedbacks").insert({ ...row, created_by: auth.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-feedbacks"] }),
  });
}

export function useDeleteTrainingFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_feedbacks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-feedbacks"] }),
  });
}

export interface FeedbackTrainingOption {
  id: string;
  name: string;
  startDate: string | null;
}

/** Sessions qui ont des retours à froid soumis ou des retours libres, pour les proposer à l'analyse. */
export function useTrainingsWithFeedback() {
  return useQuery({
    queryKey: ["trainings-with-feedback"],
    queryFn: async () => {
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
    },
  });
}
