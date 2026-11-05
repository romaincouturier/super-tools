import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTrainingFeedback,
  fetchTrainingFeedbacks,
  fetchTrainingsWithFeedback,
  insertTrainingFeedback,
  type TrainingFeedbackInsert,
} from "@/services/trainingFeedbacks";

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

export function useTrainingFeedbacks(trainingId: string, participantId?: string) {
  return useQuery({
    queryKey: ["training-feedbacks", trainingId, participantId ?? null],
    queryFn: () => fetchTrainingFeedbacks(trainingId, participantId),
    enabled: !!trainingId,
  });
}

export function useSaveTrainingFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: TrainingFeedbackInsert) => insertTrainingFeedback(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-feedbacks"] }),
  });
}

export function useDeleteTrainingFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrainingFeedback(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-feedbacks"] }),
  });
}

export function useTrainingsWithFeedback() {
  return useQuery({ queryKey: ["trainings-with-feedback"], queryFn: fetchTrainingsWithFeedback });
}
