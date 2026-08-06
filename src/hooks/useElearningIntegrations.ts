import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computeCourseIntegration,
  sortBySeverity,
  summarize,
  type CourseIntegration,
  type IntegrationSummary,
} from "@/lib/elearningIntegration";

interface ElearningIntegrationsData {
  results: CourseIntegration[];
  byCourseId: Record<string, CourseIntegration>;
  summary: IntegrationSummary;
}

/**
 * Diagnostic d'intégration supertilt.fr ↔ e-learning, par cours LMS.
 * Lecture seule : agrège lms_courses / trainings / training_formulas /
 * formation_formulas et reconstitue la chaîne d'inscription automatique.
 */
export function useElearningIntegrations() {
  return useQuery<ElearningIntegrationsData>({
    queryKey: ["elearning-integrations"],
    queryFn: async () => {
      const [coursesRes, trainingsRes, linksRes, formulasRes] = await Promise.all([
        supabase.from("lms_courses").select("id, title, access_type"),
        supabase
          .from("trainings")
          .select("id, training_name, is_cancelled, catalog_id, supports_lms_course_id")
          .not("supports_lms_course_id", "is", null),
        supabase.from("training_formulas").select("training_id, formula_id"),
        supabase.from("formation_formulas").select("id, name, formation_config_id, woocommerce_product_id"),
      ]);

      const firstError = coursesRes.error || trainingsRes.error || linksRes.error || formulasRes.error;
      if (firstError) throw firstError;

      const courses = coursesRes.data ?? [];
      const trainings = trainingsRes.data ?? [];
      const links = linksRes.data ?? [];
      const formulas = formulasRes.data ?? [];

      const results = sortBySeverity(
        courses.map((c) => computeCourseIntegration(c, trainings, links, formulas)),
      );
      const byCourseId = Object.fromEntries(results.map((r) => [r.courseId, r]));

      return { results, byCourseId, summary: summarize(results) };
    },
  });
}
