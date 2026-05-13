import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PollingCursor {
  source: string;
  last_synced_at: string | null;
  status: "idle" | "running" | "error";
  last_error: string | null;
}

export function usePollingCursor(source: string) {
  return useQuery<PollingCursor | null>({
    queryKey: ["polling-cursor", source],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polling_cursors")
        .select("source, last_synced_at, status, last_error")
        .eq("source", source)
        .single();
      if (error) throw error;
      return data as PollingCursor | null;
    },
    refetchInterval: 30000,
  });
}

/**
 * Calculate next run for a hourly cron (0 * * * *)
 * Returns the next full hour from now.
 */
export function getNextHourlyRun(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now;
}

export function formatNextRun(nextRun: Date): string {
  return nextRun.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
