import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROUTE = "/emails-a-valider";

export function useEmailDraftsAlert(): boolean {
  const location = useLocation();
  const seenRef = useRef(location.pathname.startsWith(ROUTE));

  useEffect(() => {
    if (location.pathname.startsWith(ROUTE)) {
      seenRef.current = true;
    } else {
      seenRef.current = false;
    }
  }, [location.pathname]);

  const { data: count = 0 } = useQuery({
    queryKey: ["email-drafts-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("mission_email_drafts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (location.pathname.startsWith(ROUTE)) return false;
  return count > 0;
}
