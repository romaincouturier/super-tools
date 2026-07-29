/**
 * wp-statistics-sync — instantané quotidien du trafic WordPress.
 *
 * WP-Statistics ne conserve pas d'historique interrogeable par plage sur
 * cette installation (le champ wp_articles.views est un compteur cumulé
 * écrasé à chaque import). Ce cron fige chaque jour : total, vues par page,
 * sites référents, moteurs de recherche et référents IA — ces derniers étant
 * la seule mesure factuelle de visibilité dans les moteurs génératifs.
 *
 * Body : { date?: "YYYY-MM-DD" } (défaut : hier)
 * Auth : x-cron-secret (SEO_CRON_SECRET), x-internal-secret ou JWT.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Moteurs de recherche classiques et moteurs génératifs, distingués pour
 * pouvoir suivre la visibilité GEO séparément du SEO. */
const SEARCH_ENGINES: Array<{ match: RegExp; name: string }> = [
  { match: /(^|\.)google\./i, name: "Google" },
  { match: /(^|\.)bing\.com$/i, name: "Bing" },
  { match: /(^|\.)yahoo\./i, name: "Yahoo" },
  { match: /(^|\.)yandex\./i, name: "Yandex" },
  { match: /(^|\.)duckduckgo\.com$/i, name: "DuckDuckGo" },
  { match: /(^|\.)ecosia\.org$/i, name: "Ecosia" },
  { match: /(^|\.)qwant\.com$/i, name: "Qwant" },
  { match: /brave\.com$/i, name: "Brave Search" },
  { match: /(^|\.)baidu\.com$/i, name: "Baidu" },
  { match: /(^|\.)lilo\./i, name: "Lilo" },
  { match: /(^|\.)startpage\.com$/i, name: "Startpage" },
];

const AI_REFERRERS: Array<{ match: RegExp; name: string }> = [
  { match: /(^|\.)chatgpt\.com$/i, name: "ChatGPT" },
  { match: /(^|\.)openai\.com$/i, name: "ChatGPT" },
  { match: /(^|\.)perplexity\.ai$/i, name: "Perplexity" },
  { match: /(^|\.)claude\.ai$/i, name: "Claude" },
  { match: /(^|\.)gemini\.google\.com$/i, name: "Gemini" },
  { match: /(^|\.)bard\.google\.com$/i, name: "Gemini" },
  { match: /copilot\.microsoft\.com$/i, name: "Copilot" },
  { match: /(^|\.)mistral\.ai$/i, name: "Le Chat (Mistral)" },
  { match: /(^|\.)you\.com$/i, name: "You.com" },
  { match: /(^|\.)phind\.com$/i, name: "Phind" },
];

function classify(domain: string, table: Array<{ match: RegExp; name: string }>): string | null {
  const d = domain.toLowerCase().trim();
  for (const { match, name } of table) if (match.test(d)) return name;
  return null;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function wpFetch(
  baseUrl: string,
  token: string,
  endpoint: string,
  params: Record<string, string>,
): Promise<unknown> {
  const query = new URLSearchParams({ ...params, token_auth: token });
  const res = await fetch(`${baseUrl}/wp-json/wpstatistics/v1/${endpoint}?${query}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WP-Statistics ${endpoint}: ${res.status} ${detail.slice(0, 200)}`);
  }
  return await res.json();
}

interface TrafficRow {
  date: string;
  scope: string;
  key: string;
  label: string | null;
  views: number;
  visitors: number;
}

async function syncDay(admin: SupabaseClient, baseUrl: string, token: string, date: string): Promise<Record<string, number>> {
  const range = { rangestartdate: date, rangeenddate: date };
  const rows: TrafficRow[] = [];

  // ── Vues par page ─────────────────────────────────────────
  const pages = await wpFetch(baseUrl, token, "pages", { ...range, per_page: "500", number: "500" });
  const pageTotals = new Map<string, { views: number; title: string | null }>();
  if (Array.isArray(pages)) {
    for (const p of pages as Array<Record<string, unknown>>) {
      const uri = String(p?.uri ?? p?.page ?? "").trim();
      if (!uri) continue;
      const views = Number(p?.count ?? p?.hits ?? p?.views ?? 0);
      const current = pageTotals.get(uri);
      if (current) current.views += views;
      else pageTotals.set(uri, { views, title: (p?.title as string) ?? null });
    }
  }
  for (const [uri, value] of pageTotals) {
    rows.push({ date, scope: "page", key: uri, label: value.title, views: value.views, visitors: 0 });
  }

  // ── Référents, moteurs de recherche, moteurs génératifs ───
  const referrers = await wpFetch(baseUrl, token, "referrers", { ...range, top_referrers: "300" });
  const engineTotals = new Map<string, number>();
  const aiTotals = new Map<string, number>();
  if (Array.isArray(referrers)) {
    for (const r of referrers as Array<Record<string, unknown>>) {
      const domain = String(r?.referred ?? "").trim();
      if (!domain) continue;
      const total = Number(r?.total ?? 0);
      rows.push({ date, scope: "referrer", key: domain, label: null, views: total, visitors: 0 });

      const engine = classify(domain, SEARCH_ENGINES);
      if (engine) engineTotals.set(engine, (engineTotals.get(engine) ?? 0) + total);
      const ai = classify(domain, AI_REFERRERS);
      if (ai) aiTotals.set(ai, (aiTotals.get(ai) ?? 0) + total);
    }
  }
  for (const [name, total] of engineTotals) {
    rows.push({ date, scope: "search_engine", key: name, label: name, views: total, visitors: 0 });
  }
  for (const [name, total] of aiTotals) {
    rows.push({ date, scope: "ai_referrer", key: name, label: name, views: total, visitors: 0 });
  }

  // ── Total du jour ─────────────────────────────────────────
  const totalViews = [...pageTotals.values()].reduce((s, v) => s + v.views, 0);
  let visitors = 0;
  try {
    const raw = await wpFetch(baseUrl, token, "visitors", { ...range, per_page: "1" });
    if (Array.isArray(raw)) visitors = raw.length;
    else if (raw && typeof raw === "object") {
      const value = (raw as Record<string, unknown>).visitors ?? (raw as Record<string, unknown>).total;
      visitors = Number(value ?? 0);
    }
  } catch (e) {
    console.warn("wp-statistics-sync: visiteurs indisponibles", e);
  }
  rows.push({ date, scope: "total", key: "", label: null, views: totalViews, visitors });

  const { error: delError } = await admin.from("wp_traffic_daily").delete().eq("date", date);
  if (delError) throw new Error(`purge wp_traffic_daily: ${delError.message}`);

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("wp_traffic_daily").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`insert wp_traffic_daily: ${error.message}`);
  }

  return {
    pages: pageTotals.size,
    referrers: Array.isArray(referrers) ? referrers.length : 0,
    search_engines: engineTotals.size,
    ai_referrers: aiTotals.size,
    total_views: totalViews,
  };
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
    const isInternal = internalSecret === SERVICE_ROLE ||
      (cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret);

    if (!isInternal) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return createErrorResponse("Missing Authorization header", 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return createErrorResponse("Invalid or expired session", 401);
    }

    const body = await req.json().catch(() => ({})) as { date?: string };
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : isoDay(yesterday);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await admin
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["wp_statistics_api_token", "woocommerce_store_url"]);

    const map: Record<string, string> = {};
    for (const s of (settings ?? []) as Array<{ setting_key: string; setting_value: string | null }>) {
      if (s.setting_value) map[s.setting_key] = s.setting_value;
    }
    if (!map.wp_statistics_api_token) return createErrorResponse("WP-Statistics API token not configured", 400);
    if (!map.woocommerce_store_url) return createErrorResponse("WordPress store URL not configured", 400);

    const result = await syncDay(
      admin,
      map.woocommerce_store_url.replace(/\/$/, ""),
      map.wp_statistics_api_token,
      date,
    );

    return createJsonResponse({ date, ...result });
  } catch (error) {
    console.error("wp-statistics-sync error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
      { cause: error, fn: "wp-statistics-sync" },
    );
  }
});
