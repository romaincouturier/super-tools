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
