/**
 * Analyses SEO / GEO / éditoriales, partagées entre l'UI (gsc-statistics) et
 * le connecteur MCP (mcp-server).
 *
 * Même principe que mission-tools.ts : une seule implémentation, pour que la
 * page Statistiques et Claude voient exactement les mêmes chiffres. Les
 * agrégations lourdes sont faites en SQL (fonctions gsc_aggregate,
 * seo_content_performance, seo_cannibalisation…) ; ce module compose, compare
 * les périodes et calcule les diagnostics.
 *
 * Toutes les données proviennent des tables historisées (gsc_metrics_daily,
 * gsc_url_inspections, gsc_sitemaps, wp_traffic_daily) alimentées par les
 * crons gsc-sync et wp-statistics-sync. Aucun appel réseau ici.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeUrl } from "./gsc.ts";

export interface Period {
  from: string;
  to: string;
}

export interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DimensionRow {
  key: string;
  key_2?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previous?: { clicks: number; impressions: number; ctr: number; position: number };
  delta_clicks?: number;
  delta_impressions?: number;
  delta_position?: number;
}

/**
 * CTR observé en moyenne par position dans les résultats Google. Sert de
 * référence pour repérer les pages qui rankent bien mais dont le titre ou la
 * description ne donne pas envie de cliquer.
 */
const EXPECTED_CTR: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.06,
  6: 0.05, 7: 0.04, 8: 0.033, 9: 0.028, 10: 0.025,
};

function expectedCtr(position: number): number {
  if (position < 1) return EXPECTED_CTR[1];
  if (position <= 10) return EXPECTED_CTR[Math.round(position)] ?? 0.025;
  if (position <= 20) return 0.012;
  return 0.005;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Période de même longueur immédiatement antérieure. */
export function previousPeriod(period: Period): Period {
  const length = daysBetween(period.from, period.to);
  const end = new Date(`${period.from}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (length - 1));
  return { from: isoDay(start), to: isoDay(end) };
}

/**
 * Période par défaut : Search Console publie avec environ deux jours de
 * décalage, la fenêtre s'arrête donc à J-2.
 */
export function defaultPeriod(days = 28, lagDays = 2): Period {
  const to = new Date();
  to.setUTCDate(to.getUTCDate() - lagDays);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

interface AggregateRow {
  key_1: string;
  key_2: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

async function aggregate(
  supabase: SupabaseClient,
  period: Period,
  dimension: string,
  opts: { searchType?: string; limit?: number; contains?: string } = {},
): Promise<AggregateRow[]> {
  const { data, error } = await supabase.rpc("gsc_aggregate", {
    p_from: period.from,
    p_to: period.to,
    p_dimension: dimension,
    p_search_type: opts.searchType ?? "web",
    p_limit: opts.limit ?? 100,
    p_contains: opts.contains ?? null,
  });
  if (error) throw new Error(`gsc_aggregate(${dimension}): ${error.message}`);
  return (data ?? []) as AggregateRow[];
}

function sumTotals(rows: AggregateRow[]): Totals {
  const clicks = rows.reduce((s, r) => s + Number(r.clicks), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions), 0);
  const weighted = rows.reduce((s, r) => s + Number(r.position ?? 0) * Number(r.impressions), 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? round(clicks / impressions, 4) : 0,
    position: impressions ? round(weighted / impressions, 2) : 0,
  };
}

/** Étendue réellement couverte par l'historisation, pour ne jamais laisser
 * croire à une période complète quand la synchro n'a pas encore tourné. */
export async function getDataCoverage(supabase: SupabaseClient): Promise<{
  first_date: string | null;
  last_date: string | null;
  days_stored: number;
  wp_traffic_last_date: string | null;
  urls_inspected: number;
  last_inspection: string | null;
}> {
  const [firstRes, lastRes, wpRes, inspectRes] = await Promise.all([
    supabase.from("gsc_metrics_daily").select("date").eq("dimension", "total").order("date", { ascending: true }).limit(1),
    supabase.from("gsc_metrics_daily").select("date").eq("dimension", "total").order("date", { ascending: false }).limit(1),
    supabase.from("wp_traffic_daily").select("date").order("date", { ascending: false }).limit(1),
    supabase.from("gsc_url_inspections").select("inspected_at", { count: "exact" }).order("inspected_at", { ascending: false }).limit(1),
  ]);

  const first = (firstRes.data?.[0] as { date?: string } | undefined)?.date ?? null;
  const last = (lastRes.data?.[0] as { date?: string } | undefined)?.date ?? null;
  return {
    first_date: first,
    last_date: last,
    days_stored: first && last ? daysBetween(first, last) : 0,
    wp_traffic_last_date: (wpRes.data?.[0] as { date?: string } | undefined)?.date ?? null,
    urls_inspected: inspectRes.count ?? 0,
    last_inspection: (inspectRes.data?.[0] as { inspected_at?: string } | undefined)?.inspected_at ?? null,
  };
}

export interface SeoPerformanceOptions {
  from?: string;
  to?: string;
  days?: number;
  dimension?: "query" | "page" | "country" | "device" | "appearance" | "page_query";
  search_type?: string;
  limit?: number;
  contains?: string;
  compare?: boolean;
}

/**
 * Performance SEO d'une période : totaux, série journalière, détail par
 * dimension, et comparaison avec la période précédente de même longueur.
 */
export async function getSeoPerformance(
  supabase: SupabaseClient,
  opts: SeoPerformanceOptions = {},
): Promise<Record<string, unknown>> {
  const period: Period = opts.from && opts.to
    ? { from: opts.from, to: opts.to }
    : defaultPeriod(opts.days ?? 28);
  const compare = opts.compare !== false;
  const previous = previousPeriod(period);
  const dimension = opts.dimension ?? "query";
  const searchType = opts.search_type ?? "web";
  const limit = Math.min(opts.limit ?? 25, 500);

  const [dailyRes, currentRows, previousRows, previousDaily] = await Promise.all([
    supabase.rpc("gsc_daily_totals", { p_from: period.from, p_to: period.to, p_search_type: searchType }),
    aggregate(supabase, period, dimension, { searchType, limit, contains: opts.contains }),
    compare ? aggregate(supabase, previous, dimension, { searchType, limit: limit * 4, contains: opts.contains }) : Promise.resolve([]),
    compare
      ? supabase.rpc("gsc_daily_totals", { p_from: previous.from, p_to: previous.to, p_search_type: searchType })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  if (dailyRes.error) throw new Error(`gsc_daily_totals: ${dailyRes.error.message}`);

  const daily = (dailyRes.data ?? []) as Array<{ date: string; clicks: number; impressions: number; ctr: number | null; position: number | null }>;
  const totals = sumTotals(daily.map((d) => ({ key_1: d.date, key_2: "", clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position })));
  const prevDaily = ((previousDaily as { data?: unknown[] }).data ?? []) as typeof daily;
  const prevTotals = sumTotals(prevDaily.map((d) => ({ key_1: d.date, key_2: "", clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position })));

  const prevByKey = new Map<string, AggregateRow>();
  for (const r of previousRows) prevByKey.set(`${r.key_1} ${r.key_2}`, r);

  const rows: DimensionRow[] = currentRows.map((r) => {
    const prev = prevByKey.get(`${r.key_1} ${r.key_2}`);
    const row: DimensionRow = {
      key: r.key_1,
      clicks: Number(r.clicks),
      impressions: Number(r.impressions),
      ctr: round(Number(r.ctr ?? 0), 4),
      position: round(Number(r.position ?? 0), 2),
    };
    if (dimension === "page_query") row.key_2 = r.key_2;
    if (prev) {
      row.previous = {
        clicks: Number(prev.clicks),
        impressions: Number(prev.impressions),
        ctr: round(Number(prev.ctr ?? 0), 4),
        position: round(Number(prev.position ?? 0), 2),
      };
      row.delta_clicks = Number(r.clicks) - Number(prev.clicks);
      row.delta_impressions = Number(r.impressions) - Number(prev.impressions);
      row.delta_position = round(Number(prev.position ?? 0) - Number(r.position ?? 0), 2);
    } else if (compare) {
      row.delta_clicks = Number(r.clicks);
      row.delta_impressions = Number(r.impressions);
    }
    return row;
  });

  const coverage = await getDataCoverage(supabase);

  return {
    period,
    previous_period: compare ? previous : null,
    search_type: searchType,
    dimension,
    totals,
    previous_totals: compare ? prevTotals : null,
    evolution: compare
      ? {
        clicks_pct: pct(totals.clicks, prevTotals.clicks),
        impressions_pct: pct(totals.impressions, prevTotals.impressions),
        ctr_points: round((totals.ctr - prevTotals.ctr) * 100, 2),
        position_gain: round(prevTotals.position - totals.position, 2),
      }
      : null,
    daily: daily.map((d) => ({
      date: d.date,
      clicks: Number(d.clicks),
      impressions: Number(d.impressions),
      ctr: round(Number(d.ctr ?? 0), 4),
      position: round(Number(d.position ?? 0), 2),
    })),
    rows,
    data_coverage: coverage,
    note: "delta_position positif = la page remonte dans les résultats (position moyenne plus proche de 1).",
  };
}

/**
 * Diagnostic : ce sur quoi agir, classé par impact. Chaque bloc est calculé
 * à partir des données stockées, jamais estimé.
 */
export async function getSeoOpportunities(
  supabase: SupabaseClient,
  opts: { from?: string; to?: string; days?: number; limit?: number } = {},
): Promise<Record<string, unknown>> {
  const period: Period = opts.from && opts.to ? { from: opts.from, to: opts.to } : defaultPeriod(opts.days ?? 90);
  const previous = previousPeriod(period);
  const limit = Math.min(opts.limit ?? 20, 100);

  // Les quatre agrégations gsc_aggregate sont les requêtes les plus lourdes de
  // la fonction. Lancées en parallèle, elles multiplient le work_mem et la
  // pression I/O sur gsc_metrics_daily et finissent en statement timeout.
  // Elles sont donc séquentielles ; seules les lectures légères restent en
  // parallèle.
  const queries = await aggregate(supabase, period, "query", { limit: 1000 });
  const prevQueries = await aggregate(supabase, previous, "query", { limit: 1000 });
  const pages = await aggregate(supabase, period, "page", { limit: 1000 });
  const prevPages = await aggregate(supabase, previous, "page", { limit: 1000 });

  const [cannibal, inspections, sitemaps, aiReferrers] = await Promise.all([
    supabase.rpc("seo_cannibalisation", { p_from: period.from, p_to: period.to, p_min_impressions: 30, p_limit: limit }),
    supabase
      .from("gsc_url_inspections")
      .select("url, verdict, coverage_state, indexing_state, page_fetch_state, google_canonical, user_canonical, last_crawl_time, rich_result_types, inspected_at"),
    supabase.from("gsc_sitemaps").select("path, last_downloaded, errors, warnings, is_pending, contents"),
    supabase
      .from("wp_traffic_daily")
      .select("key, label, views")
      .eq("scope", "ai_referrer")
      .gte("date", period.from)
      .lte("date", period.to),
  ]);


  const prevQueryMap = new Map(prevQueries.map((r) => [r.key_1, r]));
  const prevPageMap = new Map(prevPages.map((r) => [normalizeUrl(r.key_1), r]));

  // Quick wins : positions 4 à 20, déjà visibles, un cran de plus les met
  // dans la zone cliquée. Triés par clics potentiels et non par impressions.
  const quickWins = queries
    .filter((r) => Number(r.position ?? 0) >= 4 && Number(r.position ?? 0) <= 20 && Number(r.impressions) >= 30)
    .map((r) => {
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      const potential = Math.round(impressions * expectedCtr(3)) - clicks;
      return {
        query: r.key_1,
        clicks,
        impressions,
        ctr: round(Number(r.ctr ?? 0), 4),
        position: round(Number(r.position ?? 0), 2),
        potential_extra_clicks: Math.max(0, potential),
      };
    })
    .sort((a, b) => b.potential_extra_clicks - a.potential_extra_clicks)
    .slice(0, limit);

  // CTR anormalement bas pour la position : problème de titre ou de
  // description affichée dans les résultats, pas de positionnement.
  const lowCtr = pages
    .filter((r) => Number(r.impressions) >= 100 && Number(r.position ?? 99) <= 15)
    .map((r) => {
      const expected = expectedCtr(Number(r.position ?? 99));
      return {
        page: r.key_1,
        clicks: Number(r.clicks),
        impressions: Number(r.impressions),
        ctr: round(Number(r.ctr ?? 0), 4),
        expected_ctr: expected,
        gap_ratio: round(Number(r.ctr ?? 0) / expected, 2),
        position: round(Number(r.position ?? 0), 2),
      };
    })
    .filter((r) => r.gap_ratio < 0.6)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);

  // Requêtes qui rapportent zéro clic malgré une exposition réelle.
  const zeroClick = queries
    .filter((r) => Number(r.clicks) === 0 && Number(r.impressions) >= 50)
    .map((r) => ({
      query: r.key_1,
      impressions: Number(r.impressions),
      position: round(Number(r.position ?? 0), 2),
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);

  const decliningPages = pages
    .map((r) => {
      const prev = prevPageMap.get(normalizeUrl(r.key_1));
      const prevClicks = prev ? Number(prev.clicks) : 0;
      return {
        page: r.key_1,
        clicks: Number(r.clicks),
        previous_clicks: prevClicks,
        delta_clicks: Number(r.clicks) - prevClicks,
        variation_pct: pct(Number(r.clicks), prevClicks),
        position: round(Number(r.position ?? 0), 2),
        previous_position: prev ? round(Number(prev.position ?? 0), 2) : null,
      };
    })
    .filter((r) => r.previous_clicks >= 20 && (r.variation_pct ?? 0) <= -25)
    .sort((a, b) => a.delta_clicks - b.delta_clicks)
    .slice(0, limit);

  const risingQueries = queries
    .map((r) => {
      const prev = prevQueryMap.get(r.key_1);
      const prevImpr = prev ? Number(prev.impressions) : 0;
      return {
        query: r.key_1,
        impressions: Number(r.impressions),
        previous_impressions: prevImpr,
        variation_pct: pct(Number(r.impressions), prevImpr),
        clicks: Number(r.clicks),
        position: round(Number(r.position ?? 0), 2),
      };
    })
    .filter((r) => r.impressions >= 50 && (r.previous_impressions === 0 || (r.variation_pct ?? 0) >= 40))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);

  const inspectionRows = (inspections.data ?? []) as Array<Record<string, unknown>>;
  const notIndexed = inspectionRows
    .filter((r) => r.verdict !== "PASS")
    .map((r) => ({
      url: r.url,
      verdict: r.verdict,
      coverage_state: r.coverage_state,
      indexing_state: r.indexing_state,
      page_fetch_state: r.page_fetch_state,
      last_crawl_time: r.last_crawl_time,
    }));

  const canonicalMismatch = inspectionRows
    .filter((r) => r.google_canonical && r.user_canonical && normalizeUrl(r.google_canonical as string) !== normalizeUrl(r.user_canonical as string))
    .map((r) => ({ url: r.url, google_canonical: r.google_canonical, user_canonical: r.user_canonical }));

  const withRichResults = inspectionRows.filter((r) => Array.isArray(r.rich_result_types) && (r.rich_result_types as string[]).length > 0).length;

  const { count: publishedArticles } = await supabase
    .from("wp_articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "publish");

  const aiViews = new Map<string, number>();
  for (const row of (aiReferrers.data ?? []) as Array<{ key: string; label: string | null; views: number }>) {
    aiViews.set(row.label || row.key, (aiViews.get(row.label || row.key) ?? 0) + Number(row.views));
  }

  const sitemapRows = (sitemaps.data ?? []) as Array<Record<string, unknown>>;

  return {
    period,
    previous_period: previous,
    quick_wins: quickWins,
    low_ctr_pages: lowCtr,
    zero_click_queries: zeroClick,
    declining_pages: decliningPages,
    rising_queries: risingQueries,
    cannibalisation: cannibal.error ? [] : (cannibal.data ?? []),
    indexation: {
      articles_published: publishedArticles ?? 0,
      urls_inspected: inspectionRows.length,
      urls_indexed: inspectionRows.filter((r) => r.verdict === "PASS").length,
      urls_not_indexed: notIndexed.length,
      not_indexed_sample: notIndexed.slice(0, limit),
      canonical_mismatch: canonicalMismatch.slice(0, limit),
      urls_with_rich_results: withRichResults,
    },
    sitemaps: sitemapRows.map((s) => ({
      path: s.path,
      last_downloaded: s.last_downloaded,
      errors: s.errors,
      warnings: s.warnings,
      is_pending: s.is_pending,
    })),
    geo_referrals: [...aiViews.entries()]
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views),
    reading_guide: [
      "quick_wins : requêtes en position 4-20 ; potential_extra_clicks = clics gagnés en atteignant la position 3.",
      "low_ctr_pages : gap_ratio < 0,6 signifie un CTR inférieur de plus de 40 % à la moyenne pour cette position — titre et description à retravailler avant tout autre chantier.",
      "cannibalisation : plusieurs pages positionnées sur la même requête ; consolider ou différencier.",
      "indexation : issu de l'API URL Inspection, balayage progressif — urls_inspected peut être inférieur à articles_published tant que le corpus n'est pas entièrement parcouru.",
      "geo_referrals : visites venues des moteurs génératifs (ChatGPT, Perplexity…) mesurées côté WordPress ; c'est la seule mesure GEO factuelle disponible, il n'existe pas d'API de citation.",
    ],
  };
}

/** Croisement contenus x audience, article par article. */
export async function getContentPerformance(
  supabase: SupabaseClient,
  opts: {
    from?: string;
    to?: string;
    days?: number;
    limit?: number;
    category?: string;
    with_queries?: boolean;
  } = {},
): Promise<Record<string, unknown>> {
  const period: Period = opts.from && opts.to ? { from: opts.from, to: opts.to } : defaultPeriod(opts.days ?? 90);
  const limit = Math.min(opts.limit ?? 30, 200);

  const { data, error } = await supabase.rpc("seo_content_performance", {
    p_from: period.from,
    p_to: period.to,
    p_limit: limit,
    p_category: opts.category ?? null,
  });
  if (error) throw new Error(`seo_content_performance: ${error.message}`);

  const articles = (data ?? []) as Array<Record<string, unknown>>;

  // Requêtes d'entrée des dix premiers articles : c'est ce qui permet de dire
  // pourquoi un contenu marche, pas seulement qu'il marche.
  if (opts.with_queries !== false) {
    const top = articles.slice(0, 10);
    const queries = await Promise.all(
      top.map((a) =>
        supabase.rpc("seo_queries_for_page", {
          p_from: period.from,
          p_to: period.to,
          p_page: (a.url as string) ?? "",
          p_limit: 8,
        })
      ),
    );
    top.forEach((a, i) => {
      a.top_queries = queries[i].error ? [] : (queries[i].data ?? []);
    });
  }

  const withGsc = articles.filter((a) => Number(a.impressions ?? 0) > 0).length;

  return {
    period,
    articles,
    summary: {
      articles_returned: articles.length,
      articles_with_search_impressions: withGsc,
      articles_without_search_impressions: articles.length - withGsc,
      total_clicks: articles.reduce((s, a) => s + Number(a.clicks ?? 0), 0),
      total_impressions: articles.reduce((s, a) => s + Number(a.impressions ?? 0), 0),
      total_period_views: articles.reduce((s, a) => s + Number(a.period_views ?? 0), 0),
    },
    note: "period_views vient de WP-Statistics (toutes sources), clicks/impressions de Search Console (Google uniquement). lifetime_views est le compteur figé de l'import WordPress. coverage_state et index_verdict sont vides tant que l'URL n'a pas été inspectée.",
  };
}

/**
 * Dossier de préparation d'une newsletter ou d'un point éditorial : tout ce
 * qu'il faut pour arbitrer, en un appel.
 */
export async function getEditorialBrief(
  supabase: SupabaseClient,
  opts: { days?: number; horizon_days?: number } = {},
): Promise<Record<string, unknown>> {
  const period = defaultPeriod(opts.days ?? 90);
  const today = isoDay(new Date());
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + (opts.horizon_days ?? 120));
  const horizonDay = isoDay(horizon);

  const [newsletters, cards, columns, events, trainings, participants, performance, opportunities] = await Promise.all([
    supabase
      .from("newsletters")
      .select("id, title, scheduled_date, status, sent_at, newsletter_cards(card_id, display_order, content_cards(title, description, tags))")
      .order("scheduled_date", { ascending: false })
      .limit(8),
    supabase
      .from("content_cards")
      .select("id, title, description, tags, column_id, image_url, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase.from("content_columns").select("id, name"),
    supabase
      .from("events")
      .select("id, title, event_date, location, location_type, description")
      .gte("event_date", today)
      .lte("event_date", horizonDay)
      .order("event_date", { ascending: true }),
    supabase
      .from("trainings")
      .select("id, training_name, client_name, start_date, end_date, location, format_formation, max_participants")
      .gte("start_date", today)
      .lte("start_date", horizonDay)
      .order("start_date", { ascending: true }),
    supabase.from("training_participants").select("training_id"),
    getContentPerformance(supabase, { from: period.from, to: period.to, limit: 15, with_queries: true }),
    getSeoOpportunities(supabase, { from: period.from, to: period.to, limit: 10 }),
  ]);

  const columnName = new Map(((columns.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
  const participantCount = new Map<string, number>();
  for (const p of ((participants.data ?? []) as Array<{ training_id: string }>)) {
    participantCount.set(p.training_id, (participantCount.get(p.training_id) ?? 0) + 1);
  }

  const sessions = ((trainings.data ?? []) as Array<Record<string, unknown>>).map((t) => {
    const registered = participantCount.get(t.id as string) ?? 0;
    const max = Number(t.max_participants ?? 0);
    return {
      ...t,
      registered,
      fill_rate: max > 0 ? round(registered / max, 2) : null,
      seats_left: max > 0 ? max - registered : null,
    };
  });

  const alreadyPromoted = new Set<string>();
  for (const n of ((newsletters.data ?? []) as Array<Record<string, unknown>>)) {
    for (const nc of ((n.newsletter_cards ?? []) as Array<Record<string, unknown>>)) {
      const card = nc.content_cards as { title?: string } | null;
      if (card?.title) alreadyPromoted.add(card.title);
    }
  }

  const contentCards = ((cards.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    ...c,
    column: columnName.get(c.column_id as string) ?? null,
    already_in_a_newsletter: alreadyPromoted.has(c.title as string),
  }));

  return {
    period_analysed: period,
    newsletters: newsletters.data ?? [],
    content_cards: contentCards,
    content_columns: columns.data ?? [],
    upcoming_events: events.data ?? [],
    upcoming_sessions: sessions,
    sessions_to_fill: sessions
      .filter((s) => s.fill_rate !== null && (s.fill_rate as number) < 0.7)
      .sort((a, b) => (a.fill_rate as number) - (b.fill_rate as number)),
    best_performing_content: (performance as { articles?: unknown[] }).articles ?? [],
    audience_signals: {
      rising_queries: (opportunities as { rising_queries?: unknown[] }).rising_queries ?? [],
      quick_wins: (opportunities as { quick_wins?: unknown[] }).quick_wins ?? [],
      geo_referrals: (opportunities as { geo_referrals?: unknown[] }).geo_referrals ?? [],
    },
    data_coverage: (performance as { period?: unknown }).period,
    reading_guide: [
      "already_in_a_newsletter indique qu'une carte contenu a déjà été poussée dans une newsletter passée : à ne pas remettre en une sans raison.",
      "sessions_to_fill : sessions à moins de 70 % de remplissage, à prioriser dans les blocs commerciaux.",
      "best_performing_content donne les articles les plus performants sur la période avec leurs requêtes d'entrée : c'est la matière pour choisir la une.",
      "rising_queries montre les sujets dont la demande monte : matière pour les prochains articles.",
    ],
  };
}
