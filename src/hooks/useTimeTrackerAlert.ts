import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayAsISO } from "@/lib/dateFormatters";

/**
 * Returns true if today has no time entry — prompts the user to log their work
 * before the end of their session.
 * Only active on weekdays (Mon–Fri) to avoid spurious alerts on weekends.
 */
export function useTimeTrackerAlert(): boolean {
  const today = todayAsISO();
  const dayOfWeek = new Date().getDay(); // 0 = Sun, 6 = Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const { data: hasEntryToday = false } = useQuery({
    queryKey: ["time-tracker-alert", today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .eq("entry_date", today);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: isWeekday,
    // Refresh every 5 minutes so the dot clears once an entry is added
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
  });

  return isWeekday && !hasEntryToday;
}
