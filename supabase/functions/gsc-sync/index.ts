/**
 * gsc-sync — historisation Google Search Console.
 *
 * Search Console ne conserve que 16 mois et son API impose une requête par
 * dimension : sans historisation, aucune comparaison de période n'est possible
 * et le connecteur MCP n'a rien à lire. Ce cron alimente gsc_metrics_daily,
 * gsc_url_inspections et gsc_sitemaps.
 *
 * Body :
 *   { mode: "metrics", days?: number }            fenêtre glissante (défaut 5 jours)
 *   { mode: "metrics", from: "YYYY-MM-DD", to: "YYYY-MM-DD" }   rattrapage
 *   { mode: "inspect", limit?: number }           lot d'inspections d'URL (quota 2000/jour)
 *   { mode: "sitemaps" }
 *   { mode: "all" }
 *
 * Auth : x-cron-secret (SEO_CRON_SECRET, cron planifié en base),
 * x-internal-secret (appels inter-fonctions) ou JWT d'un utilisateur connecté
 * (déclenchement manuel depuis la page Statistiques).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { getValidDriveAccessToken } from "../_shared/google-drive-helper.ts";
import {
  getGscSiteUrl,
  gscSearchAnalytics,
  gscInspectUrl,
  gscListSitemaps,
  GscError,
  type GscApiDimension,
} from "../_shared/gsc.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Une passe de synchronisation par groupe de dimensions.
 * Google renvoie une ligne par combinaison ; la date est toujours demandée en
 * première dimension pour pouvoir stocker jour par jour. */
const DIMENSION_GROUPS: Array<{
  dimension: string;
  apiDimensions: GscApiDimension[];
  rowsPerDay: number;
}> = [
  { dimension: "total", apiDimensions: ["date"], rowsPerDay: 1 },
  { dimension: "query", apiDimensions: ["date", "query"], rowsPerDay: 500 },
  { dimension: "page", apiDimensions: ["date", "page"], rowsPerDay: 500 },
  { dimension: "country", apiDimensions: ["date", "country"], rowsPerDay: 60 },
  { dimension: "device", apiDimensions: ["date", "device"], rowsPerDay: 3 },
  { dimension: "page_query", apiDimensions: ["date", "page", "query"], rowsPerDay: 300 },
];

const INSERT_CHUNK = 500;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDay(d);
}

function dayCount(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1,
  );
}

interface MetricRow {
  site_url: string;
  date: string;
  dimension: string;
  key_1: string;
  key_2: string;
  search_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function insertRows(admin: SupabaseClient, rows: MetricRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from("gsc_metrics_daily").insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) throw new Error(`insert gsc_metrics_daily: ${error.message}`);
  }
}

/**
 * Synchronise une fenêtre de dates. Purge puis réinsère chaque tranche
 * (jour, dimension) : la fonction est idempotente et peut être rejouée sur
 * n'importe quelle période sans créer de doublon.
 */
async function syncMetrics(
  admin: SupabaseClient,
  token: string,
  siteUrl: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const days = dayCount(from, to);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(shiftDay(from, i));

  const counts: Record<string, number> = {};

  for (const group of DIMENSION_GROUPS) {
    const apiRows = await gscSearchAnalytics(token, siteUrl, {
      startDate: from,
      endDate: to,
      dimensions: group.apiDimensions,
      // "all" inclut les jours non encore consolidés : la fenêtre glissante
      // les corrigera au passage suivant.
      dataState: "all",
      rowLimit: Math.min(group.rowsPerDay * days, 25000),
    });

    const rows: MetricRow[] = apiRows.map((r) => ({
      site_url: siteUrl,
      date: r.keys[0],
      dimension: group.dimension,
      key_1: group.dimension === "total" ? "" : (r.keys[1] ?? ""),
      key_2: group.dimension === "page_query" ? (r.keys[2] ?? "") : "",
      search_type: "web",
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: r.ctr,
      position: r.position,
    })).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

    const { error: delError } = await admin
      .from("gsc_metrics_daily")
      .delete()
      .eq("site_url", siteUrl)
      .eq("dimension", group.dimension)
      .eq("search_type", "web")
      .in("date", dates);
    if (delError) throw new Error(`purge ${group.dimension}: ${delError.message}`);

    await insertRows(admin, rows);
    counts[group.dimension] = rows.length;
  }

  // Apparence dans les résultats (extraits enrichis, FAQ, vidéos…) :
  // Google n'accepte pas cette dimension combinée aux autres, elle est donc
  // demandée jour par jour.
  let appearanceRows = 0;
  for (const date of dates) {
    const rows = await gscSearchAnalytics(token, siteUrl, {
      startDate: date,
      endDate: date,
      dimensions: ["searchAppearance"],
      dataState: "all",
      rowLimit: 50,
    }).catch(() => []);
    if (!rows.length) continue;

    await admin
      .from("gsc_metrics_daily")
      .delete()
      .eq("site_url", siteUrl)
      .eq("dimension", "appearance")
      .eq("search_type", "web")
      .eq("date", date);

    await insertRows(
      admin,
      rows.map((r) => ({
        site_url: siteUrl,
        date,
        dimension: "appearance",
        key_1: r.keys[0] ?? "",
        key_2: "",
        search_type: "web",
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: r.ctr,
        position: r.position,
      })),
    );
    appearanceRows += rows.length;
  }
  counts.appearance = appearanceRows;

  return counts;
}

/**
 * Inspecte un lot d'URL : d'abord celles jamais inspectées, puis les plus
 * anciennes. Quota Google : 2000 URL par jour, 600 par minute.
 */
async function syncInspections(
  admin: SupabaseClient,
  token: string,
  siteUrl: string,
  limit: number,
): Promise<{ inspected: number; failed: number; remaining_never_inspected: number }> {
  const { data: articles } = await admin
    .from("wp_articles")
    .select("url")
    .eq("status", "publish")
    .not("url", "is", null);

  const { data: inspected } = await admin
    .from("gsc_url_inspections")
    .select("url, inspected_at")
    .eq("site_url", siteUrl)
    .order("inspected_at", { ascending: true });

  const known = new Map(((inspected ?? []) as Array<{ url: string; inspected_at: string }>).map((r) => [r.url, r.inspected_at]));
  const allUrls = [...new Set(((articles ?? []) as Array<{ url: string }>).map((a) => a.url).filter(Boolean))];

  const never = allUrls.filter((u) => !known.has(u));
  const stale = ((inspected ?? []) as Array<{ url: string }>)
    .map((r) => r.url)
    .filter((u) => allUrls.includes(u));

  const batch = [...never, ...stale].slice(0, limit);

  let ok = 0;
  let failed = 0;
  for (const url of batch) {
    try {
      const result = await gscInspectUrl(token, siteUrl, url);
      const { error } = await admin.from("gsc_url_inspections").upsert(
        { site_url: siteUrl, ...result, error: null, inspected_at: new Date().toISOString() },
        { onConflict: "site_url,url" },
      );
      if (error) throw new Error(error.message);
      ok++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : "inspection failed";
      await admin.from("gsc_url_inspections").upsert(
        { site_url: siteUrl, url, error: message.slice(0, 500), inspected_at: new Date().toISOString() },
        { onConflict: "site_url,url" },
      );
      // Quota atteint : inutile d'insister sur le reste du lot.
      if (e instanceof GscError && (e.status === 429 || e.status === 403)) break;
    }
  }

  return { inspected: ok, failed, remaining_never_inspected: Math.max(0, never.length - ok) };
}

async function syncSitemaps(
  admin: SupabaseClient,
  token: string,
  siteUrl: string,
): Promise<{ sitemaps: number; errors: number }> {
  const sitemaps = await gscListSitemaps(token, siteUrl);
  for (const s of sitemaps) {
    const { error } = await admin.from("gsc_sitemaps").upsert(
      { site_url: siteUrl, ...s, synced_at: new Date().toISOString() },
      { onConflict: "site_url,path" },
    );
    if (error) throw new Error(`upsert gsc_sitemaps: ${error.message}`);
  }
  return { sitemaps: sitemaps.length, errors: sitemaps.reduce((s, m) => s + m.errors, 0) };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    // Trois voies d'authentification (règle [036]) : secret de cron dédié,
    // service_role pour les appels inter-fonctions, JWT pour l'UI.
    const cronSecret = Deno.env.get("SEO_CRON_SECRET") ?? "";
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = (!!internalSecret && internalSecret === SERVICE_ROLE) ||
      (cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret);

    if (!isInternal) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return createErrorResponse("Missing Authorization header", 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return createErrorResponse("Invalid or expired session", 401);
    }

    const body = await req.json().catch(() => ({})) as {
      mode?: string;
      days?: number;
      from?: string;
      to?: string;
      limit?: number;
    };
    const mode = body.mode || "all";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const siteUrl = await getGscSiteUrl(admin);
    if (!siteUrl) {
      return createErrorResponse(
        "Propriété Search Console non configurée. Renseignez-la dans Paramètres → Intégrations (ex: sc-domain:supertilt.fr).",
        400,
      );
    }

    const token = await getValidDriveAccessToken(admin);
    if (!token) {
      return createErrorResponse("Aucun compte Google connecté. Connectez Google dans Paramètres → Intégrations.", 400);
    }

    const result: Record<string, unknown> = { site_url: siteUrl, mode };

    if (mode === "metrics" || mode === "all") {
      // Search Console publie avec un à deux jours de décalage : la fenêtre
      // s'arrête à hier et sera rejouée les jours suivants pour consolidation.
      const to = body.to ?? shiftDay(isoDay(new Date()), -1);
      const from = body.from ?? shiftDay(to, -((body.days ?? 5) - 1));
      result.metrics = await syncMetrics(admin, token, siteUrl, from, to);
      result.window = { from, to };
    }

    if (mode === "sitemaps" || mode === "all") {
      result.sitemaps_sync = await syncSitemaps(admin, token, siteUrl);
    }

    if (mode === "inspect" || mode === "all") {
      result.inspections = await syncInspections(admin, token, siteUrl, Math.min(body.limit ?? 60, 200));
    }

    return createJsonResponse(result);
  } catch (error) {
    const status = error instanceof GscError ? error.status : 500;
    console.error("gsc-sync error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      status,
      { cause: error, fn: "gsc-sync" },
    );
  }
});
