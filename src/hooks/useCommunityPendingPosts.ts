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
        .select("id, course_id");
      const postIds: string[] = (posts || []).map((p: any) => p.id);
      if (postIds.length === 0) return { perCourse: {}, total: 0 };

      const { data: staff } = await (supabase as any)
        .from("practice_post_comments")
        .select("post_id")
        .in("post_id", postIds)
        .eq("is_staff_reply", true);
      const repliedTo = new Set<string>((staff || []).map((c: any) => c.post_id));

      const perCourse: Record<string, number> = {};
      let total = 0;
      (posts || []).forEach((p: any) => {
        if (!p.course_id) return;
        if (repliedTo.has(p.id)) return;
        perCourse[p.course_id] = (perCourse[p.course_id] ?? 0) + 1;
        total += 1;
      });
      return { perCourse, total };
    },
    staleTime: 60 * 1000,
  });
}
