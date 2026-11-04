import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSoloFormula, fetchAssignedCourseIds } from "@/services/permanentTraining";

export function usePermanentTraining() {
  const client = useQueryClient();
  const associations = useQuery({ queryKey: ["training-course-associations"], queryFn: fetchAssignedCourseIds });
  const solo = useMutation({
    mutationFn: createSoloFormula,
    onSuccess: () => client.invalidateQueries({ queryKey: ["formation-formulas"] }),
  });
  return { associations, solo };
}