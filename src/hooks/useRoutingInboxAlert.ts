import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when there are order_items with validation_status = 'pending'
 * (i.e. WooCommerce products that could not be automatically routed).
 */
export function useRoutingInboxAlert(): boolean {
  const { data: hasPending = false } = useQuery({
    queryKey: ["routing-inbox-alert"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("validation_status", "pending");
      if (error) return false;
      return (count ?? 0) > 0;
    },
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  return hasPending;
}
