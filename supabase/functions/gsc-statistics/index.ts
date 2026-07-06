// Google Search Console statistics proxy
// Queries the Search Analytics API for the site configured in app_settings
// (gsc_site_url), using the unified Google OAuth token (google_tokens).
// Requires the "webmasters.readonly" scope — added to google-auth SCOPES.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { getValidDriveAccessToken } from "../_shared/google-drive-helper.ts";

const ALLOWED_DIMENSIONS = ["date", "query", "page"];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    // ── Auth: require a Supabase JWT ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Missing Authorization header", 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const dimension: string = (body.dimension || "date").toString();
    const from: string = (body.from || "").toString();
    const to: string = (body.to || "").toString();
    const rowLimit = Math.min(Number(body.rowLimit) || 100, 1000);

    if (!ALLOWED_DIMENSIONS.includes(dimension)) {
      return createErrorResponse(`Invalid dimension. Allowed: ${ALLOWED_DIMENSIONS.join(", ")}`, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return createErrorResponse("Invalid from/to dates (expected YYYY-MM-DD)", 400);
    }

    // ── Site URL from app_settings ────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: setting } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "gsc_site_url")
      .maybeSingle();

    const siteUrl = setting?.setting_value?.trim();
    if (!siteUrl) {
      return createErrorResponse(
        "Propriété Search Console non configurée. Renseignez-la dans Paramètres → Intégrations (ex: sc-domain:supertilt.fr ou https://www.supertilt.fr/).",
        400,
      );
    }

    // ── Google access token (unified google_tokens, auto-refresh) ────────────
    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) {
      return createErrorResponse(
        "Aucun compte Google connecté. Connectez Google dans Paramètres → Intégrations.",
        400,
      );
    }

    // ── Search Analytics query ────────────────────────────────────────────────
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const gscRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: from,
        endDate: to,
        dimensions: [dimension],
        rowLimit,
      }),
    });

    if (!gscRes.ok) {
      const errorText = await gscRes.text();
      console.error("GSC API error:", gscRes.status, errorText);
      if (gscRes.status === 401 || gscRes.status === 403) {
        return createErrorResponse(
          "Accès Search Console refusé. Reconnectez Google dans Paramètres → Intégrations (le nouveau droit « Search Console » est requis) et vérifiez que le compte a accès à la propriété configurée.",
          403,
        );
      }
      return createErrorResponse(`Google Search Console API error: ${gscRes.status}`, gscRes.status);
    }

    const data = await gscRes.json();
    const rows = Array.isArray(data.rows)
      ? data.rows.map((r: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }) => ({
          key: r.keys?.[0] ?? "",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        }))
      : [];

    return createJsonResponse({ siteUrl, dimension, from, to, rows });
  } catch (error) {
    console.error("gsc-statistics error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
