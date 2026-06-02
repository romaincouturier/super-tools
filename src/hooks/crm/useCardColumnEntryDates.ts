import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

/**
 * For each CRM card, returns the date it entered its current column.
 * Uses the latest `card_moved` activity log entry; falls back to card.created_at upstream.
 */
export function useCardColumnEntryDates() {
  return useQuery({
    queryKey: ["crm-card-column-entry-dates"],
    queryFn: async () => {
      const map = new Map<string, string>();

      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("crm_activity_log")
          .select("card_id, created_at")
          .eq("action_type", "card_moved")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data) {
          if (!map.has(row.card_id)) {
            map.set(row.card_id, row.created_at);
          }
        }

        if (data.length < PAGE_SIZE) break;
      }

      return map;
    },
    staleTime: 60_000,
  });
}
