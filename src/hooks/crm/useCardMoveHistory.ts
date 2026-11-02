import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KanbanStatsMove } from "@/types/kanban";

const PAGE_SIZE = 1000;

/** Chronological column moves per CRM card, from `card_moved` activity logs. */
export function useCardMoveHistory(enabled = true) {
  return useQuery({
    queryKey: ["crm-card-move-history"],
    enabled,
    queryFn: async () => {
      const map = new Map<string, KanbanStatsMove[]>();
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("crm_activity_log")
          .select("card_id, created_at, old_value, new_value")
          .eq("action_type", "card_moved")
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (!row.new_value) continue;
          const list = map.get(row.card_id) ?? [];
          list.push({ at: row.created_at, from: row.old_value, to: row.new_value });
          map.set(row.card_id, list);
        }
        if (data.length < PAGE_SIZE) break;
      }
      return map;
    },
    staleTime: 60_000,
  });
}
