import { useQuery } from "@tanstack/react-query";
import { checkEdgeFunctionsHealth } from "@/lib/edgeFunctionsHealth";

/**
 * Returns true when at least one expected edge function is not deployed.
 * Probes from the browser to avoid edge-runtime rate limits.
 */
export function useEdgeFunctionsAlert(): boolean {
  const { data } = useQuery({
    queryKey: ["functions-health"],
    queryFn: checkEdgeFunctionsHealth,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (data?.missing ?? 0) > 0;
}
