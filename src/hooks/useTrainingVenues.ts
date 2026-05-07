import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTrainingVenues, createTrainingVenue } from "@/services/training-venues";
import type { TrainingVenue } from "@/types/training-venue";

export function useTrainingVenues() {
  return useQuery({
    queryKey: ["training-venues"],
    queryFn: fetchTrainingVenues,
  });
}

export function useCreateTrainingVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrainingVenue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-venues"] }),
  });
}
