import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type WpEndpoint = "summary" | "hits" | "visitors" | "pages" | "browsers" | "referrers" | "search";

async function fetchWpStats(endpoint: WpEndpoint, params?: Record<string, string>) {
  const queryParams = new URLSearchParams({ endpoint, ...params });
  const { data, error } = await supabase.functions.invoke("wp-statistics-proxy", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    body: null,
  });

  // supabase.functions.invoke doesn't support query params, so use fetch directly
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/wp-statistics-proxy?${queryParams.toString()}`;
  
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useWpSummary() {
  return useQuery({
    queryKey: ["wp-statistics", "summary"],
    queryFn: () => fetchWpStats("summary"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpHits(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "hits", params],
    queryFn: () => fetchWpStats("hits", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpPages(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "pages", params],
    queryFn: () => fetchWpStats("pages", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpBrowsers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "browsers", params],
    queryFn: () => fetchWpStats("browsers", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpReferrers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "referrers", params],
    queryFn: () => fetchWpStats("referrers", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpVisitors(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "visitors", params],
    queryFn: () => fetchWpStats("visitors", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWpSearch(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["wp-statistics", "search", params],
    queryFn: () => fetchWpStats("search", params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
