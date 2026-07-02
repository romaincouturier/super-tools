import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type GscDimension = "date" | "query" | "page";

async function fetchGscStats(dimension: GscDimension, from: string, to: string, rowLimit?: number) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/gsc-statistics`;

  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ dimension, from, to, rowLimit }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.rows ?? []) as GscRow[];
}

export function useGscSearchAnalytics(dimension: GscDimension, range: { from: string; to: string }, rowLimit?: number) {
  return useQuery({
    queryKey: ["gsc-statistics", dimension, range, rowLimit],
    queryFn: () => fetchGscStats(dimension, range.from, range.to, rowLimit),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
