import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createLearnerClient } from "@/integrations/supabase/client";

export interface LearnerNotification {
  id: string;
  learner_email: string;
  type: "live_upcoming" | "replay_available";
  title: string;
  body: string;
  link: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const KEY = "learner_notifications";

export function useLearnerNotifications(email: string | null) {
  return useQuery({
    queryKey: [KEY, email],
    queryFn: async () => {
      if (!email) return [] as LearnerNotification[];
      const c = createLearnerClient(email) as any;
      const { data, error } = await c
        .from("learner_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as LearnerNotification[];
    },
    enabled: !!email,
    refetchInterval: 60_000,
  });
}

export function useMarkLearnerNotificationsRead(email: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!email || ids.length === 0) return;
      const c = createLearnerClient(email) as any;
      const { error } = await c
        .from("learner_notifications")
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, email] }),
  });
}
