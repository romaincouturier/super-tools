import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns, per course, the number of practice_posts without any staff reply.
 * Used to surface red pastilles on:
 *  - E-learning module entry in AppSidebar
 *  - "Communautés" button + each course card on /lms
 *  - Each row on /lms/communautes
 */
export function useCommunityPendingPosts() {
  return useQuery<{ perCourse: Record<string, number>; total: number }>({
    queryKey: ["community_pending_posts"],
    queryFn: async () => {
      const { data: posts } = await (supabase as any)
        .from("practice_posts")
        .select("id, course_id, is_staff_treated");

      const perCourse: Record<string, number> = {};
      let total = 0;
      (posts || []).forEach((p: any) => {
        if (!p.course_id) return;
        if (p.is_staff_treated) return;
        perCourse[p.course_id] = (perCourse[p.course_id] ?? 0) + 1;
        total += 1;
      });
      return { perCourse, total };
    },
    staleTime: 60 * 1000,
  });
}
