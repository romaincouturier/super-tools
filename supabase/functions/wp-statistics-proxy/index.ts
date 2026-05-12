import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

const ENDPOINT_MAP: Record<string, string> = {
  summary: "summary",
  hits: "hits",
  visitors: "visitors",
  pages: "pages",
  browsers: "browsers",
  referrers: "referrers",
  search: "search_engines",
  online: "online",
};
const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_MAP);

// Endpoints that accept rangestartdate/rangeenddate
// NOTE: "browsers" advertises range params but returns an empty body when they
// are passed on this WP install — so we omit range and return the global counts.
const RANGE_ENDPOINTS = new Set(["referrers", "pages", "visitors"]);

// Known search-engine host fragments → display name. Used to derive
// per-engine visit counts from the global referrers endpoint, since the
// /search_engines endpoint only returns engine *definitions* (no counts).
const SEARCH_ENGINE_DOMAINS: Array<{ match: RegExp; name: string }> = [
  { match: /(^|\.)google\./i, name: "Google" },
  { match: /(^|\.)bing\.com$/i, name: "Bing" },
  { match: /(^|\.)yahoo\./i, name: "Yahoo" },
  { match: /(^|\.)yandex\./i, name: "Yandex" },
  { match: /(^|\.)duckduckgo\.com$/i, name: "DuckDuckGo" },
  { match: /(^|\.)ecosia\.org$/i, name: "Ecosia" },
  { match: /(^|\.)qwant\.com$/i, name: "Qwant" },
  { match: /(^|\.)brave\.com$/i, name: "Brave Search" },
  { match: /search\.brave\.com$/i, name: "Brave Search" },
  { match: /(^|\.)baidu\.com$/i, name: "Baidu" },
  { match: /(^|\.)lilo\./i, name: "Lilo" },
  { match: /(^|\.)startpage\.com$/i, name: "Startpage" },
  { match: /(^|\.)chatgpt\.com$/i, name: "ChatGPT" },
  { match: /(^|\.)perplexity\.ai$/i, name: "Perplexity" },
];

function matchSearchEngine(domain: string): string | null {
  const d = domain.toLowerCase().trim();
  for (const { match, name } of SEARCH_ENGINE_DOMAINS) {
    if (match.test(d)) return name;
  }
  return null;
}
// Endpoints that accept "days" (last N days)
const DAYS_ENDPOINTS = new Set(["hits"]);

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 30;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    
    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return createErrorResponse(`Invalid endpoint. Allowed: ${ALLOWED_ENDPOINTS.join(", ")}`, 400);
    }

    // Forward extra query params, translating from/to into the API's expected names
    const forwardParams = new URLSearchParams();
    const rawFrom = url.searchParams.get("from");
    const rawTo = url.searchParams.get("to");
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "endpoint" || key === "from" || key === "to") continue;
      forwardParams.set(key, value);
    }
    if (RANGE_ENDPOINTS.has(endpoint)) {
      if (rawFrom) forwardParams.set("rangestartdate", rawFrom);
      if (rawTo) forwardParams.set("rangeenddate", rawTo);
    } else if (DAYS_ENDPOINTS.has(endpoint) && rawFrom && rawTo) {
      forwardParams.set("days", String(daysBetween(rawFrom, rawTo)));
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch token and store URL from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["wp_statistics_api_token", "woocommerce_store_url"]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) {
      if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
    }

    const token = settingsMap.wp_statistics_api_token;
    const storeUrl = settingsMap.woocommerce_store_url;

    if (!token) return createErrorResponse("WP-Statistics API token not configured", 400);
    if (!storeUrl) return createErrorResponse("WordPress store URL not configured", 400);

    // Build WP-Statistics REST API URL
    const baseUrl = storeUrl.replace(/\/$/, "");
    forwardParams.set("token_auth", token);

    // Special case: derive search-engine traffic counts from the global
    // referrers list, since /search_engines only returns engine definitions.
    if (endpoint === "search") {
      const refParams = new URLSearchParams({ token_auth: token, top_referrers: "200" });
      const refUrl = `${baseUrl}/wp-json/wpstatistics/v1/referrers?${refParams.toString()}`;
      const refRes = await fetch(refUrl, { headers: { "Accept": "application/json" } });
      if (!refRes.ok) {
        const t = await refRes.text();
        console.error("WP-Statistics referrers error:", refRes.status, t);
        return createErrorResponse(`WP-Statistics API error: ${refRes.status}`, refRes.status);
      }
      const refList = await refRes.json();
      const totals = new Map<string, number>();
      if (Array.isArray(refList)) {
        for (const r of refList) {
          const domain = String(r?.referred ?? "").trim();
          if (!domain) continue;
          const name = matchSearchEngine(domain);
          if (!name) continue;
          totals.set(name, (totals.get(name) || 0) + Number(r?.total ?? 0));
        }
      }
      const result = [...totals.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return createJsonResponse(result);
    }

    const wpEndpoint = ENDPOINT_MAP[endpoint];
    const apiUrl = `${baseUrl}/wp-json/wpstatistics/v1/${wpEndpoint}?${forwardParams.toString()}`;

    console.log(`[wp-statistics-proxy] Fetching: ${apiUrl.replace(token, '***')}`);

    const wpResponse = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error("WP-Statistics API error:", wpResponse.status, errorText);
      return createErrorResponse(`WP-Statistics API error: ${wpResponse.status}`, wpResponse.status);
    }

    // Some endpoints may return an empty body for certain param combos.
    // Fall back to {} instead of throwing on JSON parse.
    const rawBody = await wpResponse.text();
    const data = rawBody.trim() ? JSON.parse(rawBody) : {};
    return createJsonResponse(data);
  } catch (error) {
    console.error("wp-statistics-proxy error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
