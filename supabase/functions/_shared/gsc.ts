/**
 * Google Search Console — client bas niveau partagé.
 *
 * Trois API distinctes, un seul jeton (google_tokens, scope
 * webmasters.readonly) :
 *   - Search Analytics : clics, impressions, CTR, position par dimension
 *   - URL Inspection   : état d'indexation d'une URL (quota 2000/jour)
 *   - Sitemaps         : sitemaps déclarés, erreurs, dernière lecture
 *
 * Utilisé par gsc-statistics (lecture live pour l'UI) et gsc-sync (cron
 * d'historisation). Aucune logique métier ici : voir seo-tools.ts.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const GSC_DIMENSIONS = [
  "date",
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
] as const;
export type GscApiDimension = (typeof GSC_DIMENSIONS)[number];

export const GSC_SEARCH_TYPES = [
  "web",
  "image",
  "video",
  "news",
  "googleNews",
  "discover",
] as const;
export type GscSearchType = (typeof GSC_SEARCH_TYPES)[number];

export interface GscFilter {
  dimension: GscApiDimension;
  operator?: "contains" | "equals" | "notContains" | "notEquals" | "includingRegex" | "excludingRegex";
  expression: string;
}

export interface GscQuery {
  startDate: string;
  endDate: string;
  dimensions?: GscApiDimension[];
  type?: GscSearchType;
  /** "all" inclut les données fraîches non consolidées (J-1). */
  dataState?: "all" | "final";
  filters?: GscFilter[];
  /** ET entre les filtres par défaut ; "or" pour un OU. */
  filterOperator?: "and" | "or";
  rowLimit?: number;
  startRow?: number;
  aggregationType?: "auto" | "byPage" | "byProperty";
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export class GscError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GscError";
  }
}

/** Propriété Search Console configurée dans Paramètres → Intégrations. */
export async function getGscSiteUrl(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "gsc_site_url")
    .maybeSingle();
  const value = (data as { setting_value?: string } | null)?.setting_value?.trim();
  if (!value) return null;
  // Corrige les saisies du type "sc-domain:https://www.exemple.fr/" que
  // l'API refuse avec un 400 invalidParameter.
  const domainMatch = value.match(/^sc-domain:\s*(?:https?:\/\/)?(?:www\.)?([^/\s]+)\/?$/i);
  if (domainMatch) return `sc-domain:${domainMatch[1].toLowerCase()}`;
  return value;
}

function apiBase(siteUrl: string): string {
  return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`;
}

async function gscFetch(url: string, token: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("GSC API error:", res.status, detail.slice(0, 500));
    if (res.status === 401 || res.status === 403) {
      throw new GscError(
        "Accès Search Console refusé. Reconnectez Google dans Paramètres → Intégrations (droit « Search Console » requis) et vérifiez que le compte a accès à la propriété configurée.",
        403,
      );
    }
    if (res.status === 429) {
      throw new GscError("Quota Google Search Console atteint, réessayez plus tard.", 429);
    }
    throw new GscError(`Google Search Console API error: ${res.status}`, res.status);
  }

  return await res.json();
}

/**
 * Search Analytics. Pagine automatiquement au-delà des 25 000 lignes par
 * appel imposées par Google quand rowLimit est plus grand.
 */
export async function gscSearchAnalytics(
  token: string,
  siteUrl: string,
  query: GscQuery,
): Promise<GscRow[]> {
  const wanted = Math.min(query.rowLimit ?? 1000, 100000);
  const pageSize = Math.min(wanted, 25000);
  const rows: GscRow[] = [];
  let startRow = query.startRow ?? 0;

  while (rows.length < wanted) {
    const body: Record<string, unknown> = {
      startDate: query.startDate,
      endDate: query.endDate,
      rowLimit: Math.min(pageSize, wanted - rows.length),
      startRow,
    };
    if (query.dimensions?.length) body.dimensions = query.dimensions;
    if (query.type) body.type = query.type;
    if (query.dataState) body.dataState = query.dataState;
    if (query.aggregationType) body.aggregationType = query.aggregationType;
    if (query.filters?.length) {
      body.dimensionFilterGroups = [{
        groupType: query.filterOperator === "or" ? "or" : "and",
        filters: query.filters.map((f) => ({
          dimension: f.dimension,
          operator: f.operator ?? "contains",
          expression: f.expression,
        })),
      }];
    }

    const data = await gscFetch(`${apiBase(siteUrl)}/searchAnalytics/query`, token, body);
    const batch = Array.isArray(data.rows) ? (data.rows as GscRow[]) : [];
    rows.push(...batch.map((r) => ({
      keys: r.keys ?? [],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    })));
    if (batch.length < (body.rowLimit as number)) break;
    startRow += batch.length;
  }

  return rows;
}

export interface GscInspection {
  url: string;
  verdict: string | null;
  coverage_state: string | null;
  indexing_state: string | null;
  robots_txt_state: string | null;
  page_fetch_state: string | null;
  crawled_as: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
  last_crawl_time: string | null;
  sitemaps: string[];
  referring_urls: string[];
  rich_results_verdict: string | null;
  rich_result_types: string[];
  rich_result_issues: unknown;
}

/** URL Inspection API. Quota Google : 2000 URL/jour, 600/minute. */
export async function gscInspectUrl(
  token: string,
  siteUrl: string,
  inspectionUrl: string,
): Promise<GscInspection> {
  const data = await gscFetch(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    token,
    { inspectionUrl, siteUrl, languageCode: "fr-FR" },
  );

  const result = (data.inspectionResult ?? {}) as Record<string, unknown>;
  const index = (result.indexStatusResult ?? {}) as Record<string, unknown>;
  const rich = (result.richResultsResult ?? {}) as Record<string, unknown>;
  const detected = Array.isArray(rich.detectedItems) ? rich.detectedItems as Record<string, unknown>[] : [];

  return {
    url: inspectionUrl,
    verdict: (index.verdict as string) ?? null,
    coverage_state: (index.coverageState as string) ?? null,
    indexing_state: (index.indexingState as string) ?? null,
    robots_txt_state: (index.robotsTxtState as string) ?? null,
    page_fetch_state: (index.pageFetchState as string) ?? null,
    crawled_as: (index.crawledAs as string) ?? null,
    google_canonical: (index.googleCanonical as string) ?? null,
    user_canonical: (index.userCanonical as string) ?? null,
    last_crawl_time: (index.lastCrawlTime as string) ?? null,
    sitemaps: Array.isArray(index.sitemap) ? index.sitemap as string[] : [],
    referring_urls: Array.isArray(index.referringUrls) ? index.referringUrls as string[] : [],
    rich_results_verdict: (rich.verdict as string) ?? null,
    rich_result_types: detected.map((d) => String(d.richResultType ?? "")).filter(Boolean),
    rich_result_issues: detected.length ? detected : null,
  };
}

export interface GscSitemap {
  path: string;
  type: string | null;
  last_submitted: string | null;
  last_downloaded: string | null;
  is_pending: boolean;
  is_sitemaps_index: boolean;
  warnings: number;
  errors: number;
  contents: unknown;
}

export async function gscListSitemaps(token: string, siteUrl: string): Promise<GscSitemap[]> {
  const data = await gscFetch(`${apiBase(siteUrl)}/sitemaps`, token);
  const list = Array.isArray(data.sitemap) ? data.sitemap as Record<string, unknown>[] : [];
  return list.map((s) => ({
    path: String(s.path ?? ""),
    type: (s.type as string) ?? null,
    last_submitted: (s.lastSubmitted as string) ?? null,
    last_downloaded: (s.lastDownloaded as string) ?? null,
    is_pending: s.isPending === true,
    is_sitemaps_index: s.isSitemapsIndex === true,
    warnings: Number(s.warnings ?? 0),
    errors: Number(s.errors ?? 0),
    contents: s.contents ?? null,
  })).filter((s) => s.path);
}

/** Propriétés Search Console accessibles au compte connecté. */
export async function gscListSites(token: string): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  const data = await gscFetch("https://www.googleapis.com/webmasters/v3/sites", token);
  const list = Array.isArray(data.siteEntry) ? data.siteEntry as Record<string, unknown>[] : [];
  return list.map((s) => ({
    siteUrl: String(s.siteUrl ?? ""),
    permissionLevel: String(s.permissionLevel ?? ""),
  }));
}

/**
 * Normalise une URL pour rapprocher les pages Search Console des articles
 * WordPress : protocole, www, slash final et paramètres de campagne diffèrent
 * systématiquement entre les deux sources.
 */
export function normalizeUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}
