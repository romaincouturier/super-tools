import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Compteurs globaux (tous utilisateurs, 90 jours) de pages vues par segment
 * de chemin ("/crm/..." -> "crm"). Sert à trier la sidebar par popularité.
 */
export function useNavUsageCounts(): Map<string, number> {
  const { data } = useQuery({
    queryKey: ["nav-usage-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_nav_usage_counts");
      if (error) throw error;
      return (data || []) as Array<{ segment: string; clicks: number }>;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data ?? []) map.set(row.segment, Number(row.clicks));
    return map;
  }, [data]);
}
