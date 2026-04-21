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
};
const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_MAP);

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    
    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return createErrorResponse(`Invalid endpoint. Allowed: ${ALLOWED_ENDPOINTS.join(", ")}`, 400);
    }

    // Forward extra query params (e.g. per_page, paged, from, to)
    const forwardParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "endpoint") {
        forwardParams.set(key, value);
      }
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

    // Build WP-Statistics API URL
    const baseUrl = storeUrl.replace(/\/$/, "");
    forwardParams.set("token", token);
    const apiUrl = `${baseUrl}/wp-json/wp-statistics/v2/${endpoint}?${forwardParams.toString()}`;

    const wpResponse = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error("WP-Statistics API error:", wpResponse.status, errorText);
      return createErrorResponse(`WP-Statistics API error: ${wpResponse.status}`, wpResponse.status);
    }

    const data = await wpResponse.json();
    return createJsonResponse(data);
  } catch (error) {
    console.error("wp-statistics-proxy error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
