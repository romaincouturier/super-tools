import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LmsLessonOption {
  id: string;
  title: string;
  module_id: string;
  module_title: string;
  course_id: string;
  course_title: string;
  position: number;
  module_position: number;
}

/** All LMS lessons across every course, used by the link picker. */
export function useAllLmsLessons() {
  return useQuery({
    queryKey: ["lms-all-lessons-for-link-picker"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LmsLessonOption[]> => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .select(
          "id, title, position, module_id, lms_modules!inner(id, title, position, course_id, lms_courses!inner(id, title, status))",
        )
        .order("position");
      if (error) throw error;
      const rows = (data || []) as any[];
      return rows
        .map((r) => ({
          id: r.id as string,
          title: (r.title as string) || "Sans titre",
          module_id: r.module_id as string,
          module_title: r.lms_modules?.title || "",
          module_position: r.lms_modules?.position ?? 0,
          course_id: r.lms_modules?.lms_courses?.id as string,
          course_title: r.lms_modules?.lms_courses?.title as string,
          position: r.position ?? 0,
        }))
        .filter((l) => !!l.course_id)
        .sort((a, b) =>
          a.course_title.localeCompare(b.course_title) ||
          a.module_position - b.module_position ||
          a.position - b.position,
        );
    },
  });
}
