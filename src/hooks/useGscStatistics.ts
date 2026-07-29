import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GscHistoryDimension = "query" | "page" | "country" | "device" | "appearance" | "page_query";

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscDimensionRow extends GscTotals {
  key: string;
  key_2?: string;
  previous?: GscTotals;
  delta_clicks?: number;
  delta_impressions?: number;
  delta_position?: number;
}

export interface GscDataCoverage {
  first_date: string | null;
  last_date: string | null;
  days_stored: number;
  wp_traffic_last_date: string | null;
  urls_inspected: number;
  last_inspection: string | null;
}

export interface GscPerformance {
  period: { from: string; to: string };
  previous_period: { from: string; to: string } | null;
  dimension: GscHistoryDimension;
  totals: GscTotals;
  previous_totals: GscTotals | null;
  evolution: {
    clicks_pct: number | null;
    impressions_pct: number | null;
    ctr_points: number;
    position_gain: number;
  } | null;
  daily: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  rows: GscDimensionRow[];
  data_coverage: GscDataCoverage;
}

export interface GscOpportunities {
  period: { from: string; to: string };
  quick_wins: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number; potential_extra_clicks: number }>;
  low_ctr_pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; expected_ctr: number; gap_ratio: number; position: number }>;
  zero_click_queries: Array<{ query: string; impressions: number; position: number }>;
  declining_pages: Array<{ page: string; clicks: number; previous_clicks: number; delta_clicks: number; variation_pct: number | null; position: number }>;
  rising_queries: Array<{ query: string; impressions: number; previous_impressions: number; variation_pct: number | null; clicks: number; position: number }>;
  cannibalisation: Array<{ query: string; page_count: number; impressions: number; clicks: number; best_position: number; pages: string[] }>;
  indexation: {
    articles_published: number;
    urls_inspected: number;
    urls_indexed: number;
    urls_not_indexed: number;
    not_indexed_sample: Array<{ url: string; verdict: string | null; coverage_state: string | null }>;
    canonical_mismatch: Array<{ url: string; google_canonical: string; user_canonical: string }>;
    urls_with_rich_results: number;
  };
  sitemaps: Array<{ path: string; last_downloaded: string | null; errors: number; warnings: number; is_pending: boolean }>;
  geo_referrals: Array<{ source: string; views: number }>;
}

export interface GscIndexation {
  inspections: Array<{
    url: string;
    verdict: string | null;
    coverage_state: string | null;
    indexing_state: string | null;
    page_fetch_state: string | null;
    google_canonical: string | null;
    user_canonical: string | null;
    last_crawl_time: string | null;
    rich_result_types: string[] | null;
    error: string | null;
    inspected_at: string;
  }>;
  sitemaps: Array<{ path: string; last_downloaded: string | null; last_submitted: string | null; errors: number; warnings: number; is_pending: boolean }>;
  coverage: GscDataCoverage;
  summary: {
    articles_published: number;
    inspected: number;
    indexed: number;
    not_indexed: number;
    with_rich_results: number;
  };
}

async function callGsc<T>(body: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/gsc-statistics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

/** Performance lue dans l'historique SuperTools, avec comparaison de période. */
export function useGscPerformance(
  dimension: GscHistoryDimension,
  range: { from: string; to: string },
  limit = 100,
) {
  return useQuery({
    queryKey: ["gsc-statistics", "performance", dimension, range, limit],
    queryFn: () => callGsc<GscPerformance>({ action: "performance", dimension, from: range.from, to: range.to, limit }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useGscOpportunities(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["gsc-statistics", "opportunities", range],
    queryFn: () => callGsc<GscOpportunities>({ action: "opportunities", from: range.from, to: range.to, limit: 20 }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useGscIndexation() {
  return useQuery({
    queryKey: ["gsc-statistics", "indexation"],
    queryFn: () => callGsc<GscIndexation>({ action: "indexation" }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** Déclenchement manuel de la synchronisation (le cron passe chaque nuit). */
export function useGscSync() {
  return useMutation({
    mutationFn: async (body: { mode?: string; days?: number; from?: string; to?: string; limit?: number }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/gsc-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      return await response.json();
    },
  });
}
