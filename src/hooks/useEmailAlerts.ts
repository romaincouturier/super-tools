import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFailedEmailsCount(): number {
  const { data = 0 } = useQuery({
    queryKey: ["failed-emails-count"],
    queryFn: async () => {
      const [{ count: scheduledCount }, { count: failedCount }] = await Promise.all([
        supabase
          .from("scheduled_emails")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
        supabase
          .from("failed_emails")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
      ]);
      return (scheduledCount || 0) + (failedCount || 0);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data;
}
