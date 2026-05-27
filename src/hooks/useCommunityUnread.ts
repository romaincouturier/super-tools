import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["community_unread"];

/** Count of practice posts created after the current user's last_seen_at. */
export function useCommunityUnreadCount() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: state } = await (supabase as any)
        .from("community_read_state")
        .select("last_seen_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const lastSeen: string | null = (state as { last_seen_at?: string } | null)?.last_seen_at ?? null;
      if (!lastSeen) {
        // Never visited — count all posts
        const { count } = await (supabase as any)
          .from("practice_posts")
          .select("id", { count: "exact", head: true });
        return (count as number | null) ?? 0;
      }

      const { count } = await (supabase as any)
        .from("practice_posts")
        .select("id", { count: "exact", head: true })
        .gt("created_at", lastSeen);
      return (count as number | null) ?? 0;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Call on mount of the community page to mark everything as read. */
export function useMarkCommunityRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase as any)
        .from("community_read_state")
        .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
