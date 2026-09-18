import { useMutation } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/invokeEdge";

type EnrollAcademyCoursesResponse = {
  success: boolean;
  enrolled: string[];
};

/** Inscrit l'apprenant déjà connecté aux formations gratuites choisies. */
export function useAcademyEnrollment() {
  return useMutation({
    mutationFn: (courseIds: string[]) =>
      invokeEdge<EnrollAcademyCoursesResponse>("enroll-academy-courses", { courseIds }),
  });
}
