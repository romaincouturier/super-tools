import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface HealthResult {
  total: number;
  deployed: number;
  missing: number;
}

/**
 * Returns true when at least one expected edge function is not deployed.
 * Used to badge the Monitoring nav entry and the Edge Functions tab.
 */
export function useEdgeFunctionsAlert(): boolean {
  const { data } = useQuery({
    queryKey: ["functions-health"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("check-functions-health", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data as HealthResult;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return (data?.missing ?? 0) > 0;
}
