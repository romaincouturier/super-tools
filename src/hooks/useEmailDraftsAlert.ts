import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROUTE = "/avis-a-demander";

/** True when testimonial requests are waiting (badge on the sidebar entry). */
export function useEmailDraftsAlert(): boolean {
  const location = useLocation();
  const { data: count = 0 } = useQuery({
    queryKey: ["testimonial-requests-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("testimonial_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "todo");
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  if (location.pathname.startsWith(ROUTE)) return false;
  return count > 0;
}
