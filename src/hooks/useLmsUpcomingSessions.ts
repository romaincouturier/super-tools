import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UpcomingSessionRow } from "@/lib/lmsUpcomingSessions";

/** Sessions inter à venir (lecture seule, aucune donnée participant). */
export function useLmsUpcomingSessions(catalogIds: string[], maxItems: number) {
  return useQuery({
    queryKey: ["lms-upcoming-sessions", catalogIds.join(","), maxItems],
    enabled: catalogIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = supabase.rpc as any;
      const [{ data, error }, page] = await Promise.all([
        rpc("get_lms_upcoming_sessions", { _catalog_ids: catalogIds, _max_items: maxItems }),
        rpc("get_lms_catalog_page_url", { _catalog_id: catalogIds[0] }),
      ]);
      if (error) throw error;
      return { sessions: (data ?? []) as UpcomingSessionRow[], pageUrl: (page?.data as string | null) ?? null };
    },
  });
}

export function useFormationCatalogOptions() {
  return useQuery({
    queryKey: ["lms-upcoming-sessions-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("formation_configs").select("id, formation_name").order("formation_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
