import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generic "new items since last visit" alert.
 * - Tracks the last time the user visited `route` in localStorage.
 * - Queries `table` for the most recent `created_at`; returns true if it is
 *   strictly newer than the stored last-seen timestamp.
 * - When the user navigates to `route`, the last-seen timestamp is bumped to
 *   now() so the alert clears immediately.
 */
export function useNewItemsAlert(opts: {
  storageKey: string;
  table: "support_tickets" | "crm_cards" | "training_evaluations" | "questionnaire_besoins" | "ideas";
  route: string;
}): boolean {
  const { storageKey, table, route } = opts;
  const location = useLocation();
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return window.localStorage.getItem(storageKey) || new Date(0).toISOString();
  });

  // When the user visits the route, mark items as seen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.pathname.startsWith(route)) {
      const now = new Date().toISOString();
      window.localStorage.setItem(storageKey, now);
      setLastSeen(now);
    }
  }, [location.pathname, route, storageKey]);

  const { data: latest = null } = useQuery({
    queryKey: ["new-items-alert", table],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data?.created_at as string | undefined) ?? null;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!latest) return false;
  return new Date(latest).getTime() > new Date(lastSeen).getTime();
}
