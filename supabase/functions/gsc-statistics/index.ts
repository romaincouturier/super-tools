/**
 * gsc-statistics — point d'entrée Search Console de l'application.
 *
 * Deux familles d'actions :
 *   - live      : interrogation directe de l'API Search Analytics (toutes
 *                 dimensions, filtres, type de recherche, pagination)
 *   - historique: lecture des tables alimentées par le cron gsc-sync, avec
 *                 comparaison de période, diagnostics et croisement contenus
 *
 * Les analyses sont dans _shared/seo-tools.ts : la page Statistiques et le
 * connecteur MCP servent les mêmes chiffres.
 *
 * Body :
 *   { action: "live", dimension | dimensions, from, to, rowLimit, type,
 *     dataState, filters, startRow }
 *   { action: "performance", from, to, days, dimension, limit, contains, compare }
 *   { action: "opportunities", from, to, days, limit }
 *   { action: "content", from, to, days, limit, category }
 *   { action: "indexation" }
 *   { action: "sites" }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { getValidDriveAccessToken } from "../_shared/google-drive-helper.ts";
import {
  getGscSiteUrl,
  gscSearchAnalytics,
  gscListSites,
  GscError,
  GSC_DIMENSIONS,
  GSC_SEARCH_TYPES,
  type GscApiDimension,
  type GscFilter,
  type GscSearchType,
} from "../_shared/gsc.ts";
import {
  getSeoPerformance,
  getSeoOpportunities,
  getContentPerformance,
  getDataCoverage,
} from "../_shared/seo-tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Missing Authorization header", 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) || "live";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Actions servies depuis l'historique ────────────────────────────────
    if (action === "performance") {
      return createJsonResponse(await getSeoPerformance(admin, {
        from: body.from as string | undefined,
        to: body.to as string | undefined,
        days: body.days as number | undefined,
        dimension: body.dimension as "query" | undefined,
        search_type: body.type as string | undefined,
        limit: body.limit as number | undefined,
        contains: body.contains as string | undefined,
        compare: body.compare !== false,
      }));
    }

    if (action === "opportunities") {
      return createJsonResponse(await getSeoOpportunities(admin, {
        from: body.from as string | undefined,
        to: body.to as string | undefined,
        days: body.days as number | undefined,
        limit: body.limit as number | undefined,
      }));
    }

    if (action === "content") {
      return createJsonResponse(await getContentPerformance(admin, {
        from: body.from as string | undefined,
        to: body.to as string | undefined,
        days: body.days as number | undefined,
        limit: body.limit as number | undefined,
        category: body.category as string | undefined,
        with_queries: body.with_queries !== false,
      }));
    }

    if (action === "indexation") {
      const [inspections, sitemaps, coverage, articles] = await Promise.all([
        admin
          .from("gsc_url_inspections")
          .select("url, verdict, coverage_state, indexing_state, page_fetch_state, google_canonical, user_canonical, last_crawl_time, rich_result_types, error, inspected_at")
          .order("inspected_at", { ascending: false })
          .limit(1000),
        admin.from("gsc_sitemaps").select("*").order("path"),
        getDataCoverage(admin),
        admin.from("wp_articles").select("id", { count: "exact", head: true }).eq("status", "publish"),
      ]);
      const rows = (inspections.data ?? []) as Array<Record<string, unknown>>;
      return createJsonResponse({
        inspections: rows,
        sitemaps: sitemaps.data ?? [],
        coverage,
        summary: {
          articles_published: articles.count ?? 0,
          inspected: rows.length,
          indexed: rows.filter((r) => r.verdict === "PASS").length,
          not_indexed: rows.filter((r) => r.verdict && r.verdict !== "PASS").length,
          with_rich_results: rows.filter((r) => Array.isArray(r.rich_result_types) && (r.rich_result_types as string[]).length > 0).length,
        },
      });
    }

    // ── Actions nécessitant l'API Google ──────────────────────────────────
    const siteUrl = await getGscSiteUrl(admin);
    if (!siteUrl) {
      return createErrorResponse(
        "Propriété Search Console non configurée. Renseignez-la dans Paramètres → Intégrations (ex: sc-domain:supertilt.fr ou https://www.supertilt.fr/).",
        400,
      );
    }

    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) {
      return createErrorResponse(
        "Aucun compte Google connecté. Connectez Google dans Paramètres → Intégrations.",
        400,
      );
    }

    if (action === "sites") {
      return createJsonResponse({ configured: siteUrl, sites: await gscListSites(accessToken) });
    }

    // action "live" (défaut) : requête Search Analytics directe.
    const rawDimensions = Array.isArray(body.dimensions)
      ? (body.dimensions as string[])
      : [(body.dimension as string) || "date"];
    const dimensions = rawDimensions.filter((d): d is GscApiDimension =>
      (GSC_DIMENSIONS as readonly string[]).includes(d)
    );
    if (dimensions.length !== rawDimensions.length) {
      return createErrorResponse(`Invalid dimension. Allowed: ${GSC_DIMENSIONS.join(", ")}`, 400);
    }

    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return createErrorResponse("Invalid from/to dates (expected YYYY-MM-DD)", 400);
    }

    const type = body.type as GscSearchType | undefined;
    if (type && !(GSC_SEARCH_TYPES as readonly string[]).includes(type)) {
      return createErrorResponse(`Invalid type. Allowed: ${GSC_SEARCH_TYPES.join(", ")}`, 400);
    }

    const filters = Array.isArray(body.filters)
      ? (body.filters as GscFilter[]).filter((f) =>
        f && (GSC_DIMENSIONS as readonly string[]).includes(f.dimension) && typeof f.expression === "string"
      )
      : undefined;

    const rows = await gscSearchAnalytics(accessToken, siteUrl, {
      startDate: from,
      endDate: to,
      dimensions,
      type,
      dataState: body.dataState === "final" ? "final" : "all",
      filters,
      filterOperator: body.filterOperator === "or" ? "or" : "and",
      rowLimit: Math.min(Number(body.rowLimit) || 100, 25000),
      startRow: Number(body.startRow) || 0,
    });

    return createJsonResponse({
      siteUrl,
      dimension: dimensions[0],
      dimensions,
      from,
      to,
      rows: rows.map((r) => ({
        key: r.keys[0] ?? "",
        keys: r.keys,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    });
  } catch (error) {
    const status = error instanceof GscError ? error.status : 500;
    console.error("gsc-statistics error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      status,
      { cause: error, fn: "gsc-statistics" },
    );
  }
});
