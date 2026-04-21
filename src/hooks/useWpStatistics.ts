import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type WpEndpoint = 
  | "summary" | "hits" | "visitors" | "pages" | "browsers" 
  | "referrers" | "search" | "countries" | "platforms" 
  | "online" | "categories" | "authors" | "top_visitors";

async function fetchWpStats(endpoint: WpEndpoint, params?: Record<string, string>) {
  const queryParams = new URLSearchParams({ endpoint, ...params });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/wp-statistics-proxy?${queryParams.toString()}`;

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

function useWpQuery(endpoint: WpEndpoint, params?: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: ["wp-statistics", endpoint, params],
    queryFn: () => fetchWpStats(endpoint, params),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled,
  });
}

export function useWpSummary() { return useWpQuery("summary"); }
export function useWpHits(params?: Record<string, string>) { return useWpQuery("hits", params); }
export function useWpPages(params?: Record<string, string>) { return useWpQuery("pages", params); }
export function useWpBrowsers(params?: Record<string, string>) { return useWpQuery("browsers", params); }
export function useWpReferrers(params?: Record<string, string>) { return useWpQuery("referrers", params); }
export function useWpVisitors(params?: Record<string, string>) { return useWpQuery("visitors", params); }
export function useWpSearch(params?: Record<string, string>) { return useWpQuery("search", params); }
export function useWpCountries(params?: Record<string, string>) { return useWpQuery("countries", params); }
export function useWpPlatforms(params?: Record<string, string>) { return useWpQuery("platforms", params); }
export function useWpOnline() { return useWpQuery("online"); }
export function useWpCategories(params?: Record<string, string>) { return useWpQuery("categories", params); }
export function useWpAuthors(params?: Record<string, string>) { return useWpQuery("authors", params); }
export function useWpTopVisitors(params?: Record<string, string>) { return useWpQuery("top_visitors", params); }
