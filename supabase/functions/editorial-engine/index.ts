/**
 * editorial-engine (ST-2026-0220)
 *
 * Moteur d'analyse éditoriale : croise les signaux (transcripts
 * pro_exploitables, feedbacks de formation) avec le corpus existant
 * (wp_articles via embeddings, colonne Idées du kanban contenus) et les
 * données de performance réelles (Search Console, WP-Statistics, Brevo),
 * plus le contexte business (OKR, sessions programmées), pour produire une
 * recommandation éditoriale scorée dans editorial_recommendations.
 *
 * La décision finale est humaine : les recommandations restent en statut
 * "pending" jusqu'à arbitrage dans l'UI (/transcripts, onglet Recommandations).
 *
 * Déclenchement : bouton UI (JWT) ou cron hebdomadaire (x-internal-secret).
 * Body : { transcript_id?: string, limit?: number }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { embedText } from "../_shared/embeddings.ts";
import { getValidDriveAccessToken } from "../_shared/google-drive-helper.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const TYPES_BESOIN = new Set([
  "question_frequente", "probleme_terrain", "objection", "attente_avant_achat",
  "difficulte_usage", "retour_formation", "signal_faible",
]);
const CIBLES = new Set([
  "formateur", "facilitateur", "coach", "manager", "rh", "chef_de_projet",
  "product_owner_pm", "consultant", "independant_tpe", "organisation_cliente", "autre",
]);
const FORMATS = new Set(["article_blog", "post_linkedin", "video", "ressource_telechargeable", "newsletter"]);
const COUVERTURES = new Set(["non_couvert", "partiellement_couvert", "bien_couvert"]);
const NIVEAUX = new Set(["faible", "moyen", "fort"]);
const ACTIONS = new Set([
  "creer_article", "ameliorer_article", "recycler", "fusionner", "archiver",
  "creer_post_linkedin", "a_discuter", "ne_rien_faire",
]);

// Un signal déjà couvert par une recommandation existante à >= ce seuil est ignoré.
const DEDUP_SIMILARITY = 0.9;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampScore(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Chemin d'URL normalisé pour croiser wp_articles / GSC / WP-Statistics. */
function urlPath(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = raw.startsWith("http") ? new URL(raw) : new URL(raw, "https://x.local");
    return u.pathname.replace(/\/+$/, "").toLowerCase() || "/";
  } catch {
    return String(raw).split("?")[0].replace(/\/+$/, "").toLowerCase();
  }
}

type Candidate = {
  source_type: "transcript" | "feedback";
  transcript_id: string | null;
  training_id: string | null;
  label: string;
  signal: string;
};

type PerfContext = {
  gscPages: Map<string, { clicks: number; impressions: number; ctr: number; position: number }>;
  gscTopQueries: string;
  wpPages: Map<string, number>;
  topArticles: string;
  newsletter: string;
  available: string[];
};

// ── Collecte des données de performance (best effort, jamais inventées) ─────

async function fetchGsc(admin: ReturnType<typeof createClient>, settings: Record<string, string>): Promise<Pick<PerfContext, "gscPages" | "gscTopQueries"> & { ok: boolean }> {
  const empty = { gscPages: new Map(), gscTopQueries: "", ok: false };
  const siteUrl = settings.gsc_site_url;
  if (!siteUrl) return empty;
  const accessToken = await getValidDriveAccessToken(admin);
  if (!accessToken) return empty;

  const query = async (dimension: string, rowLimit: number) => {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: isoDaysAgo(92), endDate: isoDaysAgo(2), dimensions: [dimension], rowLimit }),
      },
    );
    if (!res.ok) {
      console.error("[editorial-engine] GSC error", dimension, res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  };

  const [pages, queries] = await Promise.all([query("page", 500), query("query", 40)]);
  if (pages === null && queries === null) return empty;

  const gscPages = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
  for (const r of pages ?? []) {
    gscPages.set(urlPath(r.keys?.[0]), {
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    });
  }
  const gscTopQueries = (queries ?? [])
    .slice(0, 40)
    .map((r: { keys?: string[]; clicks?: number; impressions?: number }) =>
      `"${r.keys?.[0]}" (${r.clicks ?? 0} clics, ${r.impressions ?? 0} impressions)`)
    .join("\n");
  return { gscPages, gscTopQueries, ok: true };
}

async function fetchWpStats(settings: Record<string, string>): Promise<{ wpPages: Map<string, number>; ok: boolean }> {
  const empty = { wpPages: new Map(), ok: false };
  const token = settings.wp_statistics_api_token;
  const storeUrl = settings.woocommerce_store_url;
  if (!token || !storeUrl) return empty;
  try {
    const params = new URLSearchParams({
      token_auth: token,
      rangestartdate: isoDaysAgo(90),
      rangeenddate: isoDaysAgo(0),
      number: "500",
      per_page: "500",
    });
    const res = await fetch(`${storeUrl.replace(/\/$/, "")}/wp-json/wpstatistics/v1/pages?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return empty;
    const raw = await res.text();
    const rows = raw.trim() ? JSON.parse(raw) : [];
    const wpPages = new Map<string, number>();
    if (Array.isArray(rows)) {
      for (const p of rows) {
        const path = urlPath(String(p?.uri ?? p?.page ?? ""));
        if (!path) continue;
        wpPages.set(path, (wpPages.get(path) ?? 0) + Number(p?.count ?? p?.hits ?? 0));
      }
    }
    return { wpPages, ok: true };
  } catch (e) {
    console.error("[editorial-engine] WP-Statistics error", e);
    return empty;
  }
}

async function fetchBrevo(settings: Record<string, string>): Promise<{ newsletter: string; ok: boolean }> {
  const apiKey = settings.brevo_api_key;
  if (!apiKey) return { newsletter: "", ok: false };
  try {
    const params = new URLSearchParams({ type: "classic", status: "sent", statistics: "globalStats", limit: "20", sort: "desc" });
    const res = await fetch(`https://api.brevo.com/v3/emailCampaigns?${params}`, {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) return { newsletter: "", ok: false };
    const data = await res.json();
    const lines = (Array.isArray(data.campaigns) ? data.campaigns : []).map((c: Record<string, unknown>) => {
      const s = ((c.statistics as Record<string, unknown>)?.globalStats ?? {}) as Record<string, number>;
      const delivered = s.delivered ?? 0;
      const openRate = delivered > 0 ? Math.round(((s.uniqueViews ?? 0) / delivered) * 100) : 0;
      const clickRate = delivered > 0 ? Math.round(((s.uniqueClicks ?? 0) / delivered) * 100) : 0;
      return `"${c.subject ?? c.name}" (${String(c.sentDate ?? "").slice(0, 10)}) : ${delivered} délivrés, ${openRate}% ouverture, ${clickRate}% clic`;
    });
    return { newsletter: lines.join("\n"), ok: lines.length > 0 };
  } catch (e) {
    console.error("[editorial-engine] Brevo error", e);
    return { newsletter: "", ok: false };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

  try {
    let body: { transcript_id?: string; limit?: number };
    try { body = await req.json(); } catch { body = {}; }
    const limit = Math.max(1, Math.min(Number(body.limit) || 8, 20));

    // Auth : interne (cron) ou utilisateur connecté.
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = internalSecret && internalSecret === SERVICE_ROLE;
    if (!isInternal) {
      const auth = req.headers.get("Authorization");
      if (!auth) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
      if (u.user.user_metadata?.role === "learner") return json({ error: "Forbidden" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: prompt } = await (admin as any)
      .from("transcript_ai_prompts")
      .select("system_prompt, user_prompt_template, model")
      .eq("kind", "editorial_engine")
      .maybeSingle();
    if (!prompt) return json({ error: "Prompt 'editorial_engine' introuvable (migration non appliquée ?)" }, 500);

    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["gsc_site_url", "wp_statistics_api_token", "woocommerce_store_url", "brevo_api_key"]);
    const settings: Record<string, string> = {};
    for (const s of settingsRows ?? []) if (s.setting_value) settings[s.setting_key] = s.setting_value;

    // ── 1. Backfill des embeddings d'articles (max 100 par passage) ──────────
    const { data: missingEmb } = await (admin as any)
      .from("wp_articles")
      .select("id, title, excerpt, content")
      .is("embedding", null)
      .limit(100);
    let embedded = 0;
    for (const a of missingEmb ?? []) {
      const text = `${a.title}\n${a.excerpt ?? ""}\n${(a.content ?? "").slice(0, 4000)}`;
      const emb = await embedText(text);
      if (!emb) break; // clé OpenAI absente ou en erreur : inutile d'insister
      await (admin as any).from("wp_articles").update({ embedding: emb }).eq("id", a.id);
      embedded++;
    }

    // ── 2. Contexte partagé (performance + business + corpus) ────────────────
    const [gsc, wp, brevo] = await Promise.all([
      fetchGsc(admin, settings),
      fetchWpStats(settings),
      fetchBrevo(settings),
    ]);

    const { data: topArticlesRows } = await (admin as any)
      .from("wp_articles")
      .select("title, url, views, published_at")
      .not("views", "is", null)
      .order("views", { ascending: false })
      .limit(15);
    const topArticles = (topArticlesRows ?? [])
      .map((a: any) => `"${a.title}" (${a.views} vues, publié ${String(a.published_at ?? "").slice(0, 10)})`)
      .join("\n");

    const { data: ideasCol } = await (admin as any)
      .from("content_columns").select("id").eq("name", "Idées").maybeSingle();
    let ideesExistantes = "(aucune)";
    if (ideasCol) {
      const { data: ideaCards } = await (admin as any)
        .from("content_cards")
        .select("title")
        .eq("column_id", ideasCol.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (ideaCards?.length) ideesExistantes = ideaCards.map((c: any) => `- ${c.title}`).join("\n");
    }

    const { data: okrs } = await (admin as any)
      .from("okr_objectives")
      .select("title, description")
      .eq("status", "active")
      .limit(10);
    const { data: upcoming } = await (admin as any)
      .from("trainings")
      .select("training_name, start_date, objectives")
      .gte("start_date", isoDaysAgo(0))
      .order("start_date", { ascending: true })
      .limit(15);
    const businessContext = [
      okrs?.length
        ? "OKR actifs :\n" + okrs.map((o: any) => `- ${o.title}${o.description ? ` : ${String(o.description).slice(0, 150)}` : ""}`).join("\n")
        : "OKR actifs : (aucun)",
      upcoming?.length
        ? "Sessions programmées :\n" + upcoming.map((t: any) => `- ${t.training_name} (${t.start_date})${t.objectives ? ` — objectifs : ${String(t.objectives).slice(0, 150)}` : ""}`).join("\n")
        : "Sessions programmées : (aucune)",
    ].join("\n\n");

    const available: string[] = [];
    if (gsc.ok) available.push("search_console");
    if (wp.ok) available.push("wp_statistics");
    if (brevo.ok) available.push("newsletter_brevo");
    if (topArticles) available.push("vues_articles_wp");

    const performanceContext = [
      gsc.gscTopQueries ? `Top requêtes Google (90 derniers jours) :\n${gsc.gscTopQueries}` : "Search Console : données indisponibles.",
      topArticles ? `Articles les plus consultés (vues WordPress) :\n${topArticles}` : "Vues articles : données indisponibles.",
      brevo.newsletter ? `Dernières newsletters (Brevo) :\n${brevo.newsletter}` : "Newsletter : données indisponibles.",
    ].join("\n\n");

    // ── 3. Candidats ──────────────────────────────────────────────────────────
    const candidates: Candidate[] = [];

    let transcriptQuery = (admin as any)
      .from("transcripts")
      .select("id, title, editorial_analysis")
      .eq("editorial_qualification", "pro_exploitable")
      .not("editorial_analysis", "is", null);
    if (body.transcript_id) transcriptQuery = transcriptQuery.eq("id", body.transcript_id);
    const { data: transcripts } = await transcriptQuery.order("created_at", { ascending: false }).limit(60);

    const { data: doneTranscripts } = await (admin as any)
      .from("editorial_recommendations")
      .select("transcript_id")
      .not("transcript_id", "is", null);
    const doneTranscriptIds = new Set((doneTranscripts ?? []).map((r: any) => r.transcript_id));

    for (const t of transcripts ?? []) {
      if (doneTranscriptIds.has(t.id)) continue;
      const a = t.editorial_analysis ?? {};
      const signal = [
        `Titre du transcript : ${t.title ?? "(sans titre)"}`,
        `Univers : ${a.univers ?? "?"} — Type de matière : ${a.type_matiere ?? "?"}`,
        `Risque confidentialité : ${a.risque_confidentialite ?? "?"} (${a.risque_justification ?? ""})`,
        `Résumé éditorial : ${a.resume_editorial ?? ""}`,
        `Signaux : ${(a.signaux ?? []).join(" | ")}`,
      ].join("\n");
      candidates.push({ source_type: "transcript", transcript_id: t.id, training_id: null, label: t.title ?? t.id, signal });
    }

    // Feedbacks de formation (sans transcript_id ciblé uniquement)
    if (!body.transcript_id) {
      const { data: doneTrainings } = await (admin as any)
        .from("editorial_recommendations")
        .select("training_id")
        .eq("source_type", "feedback")
        .not("training_id", "is", null);
      const doneTrainingIds = new Set((doneTrainings ?? []).map((r: any) => r.training_id));

      const { data: evals } = await (admin as any)
        .from("training_evaluations")
        .select("training_id, appreciation_generale, amelioration_suggeree, freins_application, remarques_libres, message_recommandation, trainings!inner(id, training_name, end_date)")
        .eq("etat", "soumis")
        .gte("trainings.end_date", isoDaysAgo(90));

      const byTraining = new Map<string, { name: string; texts: string[] }>();
      for (const e of evals ?? []) {
        if (!e.training_id || doneTrainingIds.has(e.training_id)) continue;
        const cur = byTraining.get(e.training_id) ?? { name: e.trainings?.training_name ?? "Formation", texts: [] };
        for (const f of [e.amelioration_suggeree, e.freins_application, e.remarques_libres, e.message_recommandation]) {
          if (f && String(f).trim().length > 15) cur.texts.push(String(f).trim());
        }
        byTraining.set(e.training_id, cur);
      }

      const trainingIds = [...byTraining.keys()];
      if (trainingIds.length) {
        const { data: besoins } = await (admin as any)
          .from("questionnaire_besoins")
          .select("training_id, competences_visees, lien_mission, commentaires_libres")
          .in("training_id", trainingIds)
          .not("date_soumission", "is", null);
        for (const b of besoins ?? []) {
          const cur = byTraining.get(b.training_id);
          if (!cur) continue;
          for (const f of [b.competences_visees, b.lien_mission, b.commentaires_libres]) {
            if (f && String(f).trim().length > 15) cur.texts.push(`[besoin] ${String(f).trim()}`);
          }
        }
      }

      for (const [trainingId, bundle] of byTraining) {
        // Moins de 2 verbatims : matière trop pauvre pour une recommandation.
        if (bundle.texts.length < 2) continue;
        const signal = [
          `Formation : ${bundle.name}`,
          `Verbatims des participants (feedbacks + recueil de besoins) :`,
          ...bundle.texts.slice(0, 40).map((t) => `- ${t}`),
        ].join("\n").slice(0, 6000);
        candidates.push({ source_type: "feedback", transcript_id: null, training_id: trainingId, label: bundle.name, signal });
      }
    }

    const toProcess = candidates.slice(0, limit);
    const results: Array<{ label: string; status: string; id?: string }> = [];

    // ── 4. Analyse candidat par candidat ─────────────────────────────────────
    for (const c of toProcess) {
      const embedding = await embedText(c.signal);

      let articlesProches = "Similarité indisponible (embeddings non configurés).";
      const proches: Array<Record<string, unknown>> = [];
      if (embedding) {
        // Dédoublonnage contre les recommandations déjà émises.
        const { data: dupes } = await (admin as any).rpc("match_editorial_recommendations", {
          query_embedding: embedding,
          match_count: 1,
        });
        if (dupes?.[0]?.similarity >= DEDUP_SIMILARITY) {
          results.push({ label: c.label, status: `doublon de "${dupes[0].titre_provisoire}"` });
          continue;
        }

        const { data: matches } = await (admin as any).rpc("match_wp_articles", {
          query_embedding: embedding,
          match_count: 5,
        });
        if (matches?.length) {
          for (const m of matches) {
            const path = urlPath(m.url);
            const gscM = gsc.gscPages.get(path);
            const wpViews = wp.wpPages.get(path);
            proches.push({
              wp_article_id: m.id,
              title: m.title,
              url: m.url,
              similarity: Math.round(m.similarity * 100) / 100,
              published_at: m.published_at,
              modified_at: m.modified_at,
              views: m.views ?? wpViews ?? null,
              gsc: gscM ?? null,
            });
          }
          articlesProches = proches.map((p: any) => {
            const perf = [
              p.views != null ? `${p.views} vues` : null,
              p.gsc ? `${p.gsc.clicks} clics SEO, ${p.gsc.impressions} impressions, position ${p.gsc.position.toFixed(1)}, CTR ${(p.gsc.ctr * 100).toFixed(1)}%` : null,
            ].filter(Boolean).join(" ; ") || "aucune donnée de performance";
            return `- "${p.title}" (similarité ${Math.round(p.similarity * 100)}%, publié ${String(p.published_at ?? "?").slice(0, 10)}, modifié ${String(p.modified_at ?? "?").slice(0, 10)}) — ${perf}`;
          }).join("\n");
        } else {
          articlesProches = "(aucun article proche trouvé)";
        }
      }

      const userPrompt = applyTemplate(prompt.user_prompt_template, {
        today: isoDaysAgo(0),
        source_type: c.source_type === "transcript" ? "transcript de réunion/formation" : "feedbacks de formation",
        signal: c.signal,
        articles_proches: articlesProches,
        idees_existantes: ideesExistantes,
        performance_context: performanceContext,
        business_context: businessContext,
      });

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: prompt.model || "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: prompt.system_prompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("[editorial-engine] AI error", aiRes.status, errText);
        results.push({ label: c.label, status: `erreur IA ${aiRes.status}` });
        if (aiRes.status === 429 || aiRes.status === 402) break;
        continue;
      }
      const aiJson = await aiRes.json();
      const parsed = extractJson((aiJson?.choices?.[0]?.message?.content ?? "").trim());
      if (!parsed) {
        results.push({ label: c.label, status: "réponse IA non parsable" });
        continue;
      }

      const cibles = (Array.isArray(parsed.cibles) ? parsed.cibles : [])
        .map((x: unknown) => String(x)).filter((x: string) => CIBLES.has(x));
      const row = {
        source_type: c.source_type,
        transcript_id: c.transcript_id,
        training_id: c.training_id,
        signal_text: c.signal.slice(0, 8000),
        embedding,
        titre_provisoire: String(parsed.titre_provisoire ?? "").slice(0, 300),
        besoin_cible: String(parsed.besoin_cible ?? "").slice(0, 1000),
        type_besoin: TYPES_BESOIN.has(String(parsed.type_besoin)) ? String(parsed.type_besoin) : null,
        cibles: cibles.length ? cibles : ["autre"],
        univers: String(parsed.univers ?? "autre").slice(0, 60),
        format_recommande: FORMATS.has(String(parsed.format_recommande)) ? String(parsed.format_recommande) : null,
        contenus_existants_proches: proches,
        niveau_couverture: COUVERTURES.has(String(parsed.niveau_couverture)) ? String(parsed.niveau_couverture) : null,
        donnees_performance: { sources_disponibles: available, articles_proches: proches },
        niveau_demande: NIVEAUX.has(String(parsed.niveau_demande)) ? String(parsed.niveau_demande) : null,
        risque_redondance: NIVEAUX.has(String(parsed.risque_redondance)) ? String(parsed.risque_redondance) : null,
        action_recommandee: ACTIONS.has(String(parsed.action_recommandee)) ? String(parsed.action_recommandee) : "a_discuter",
        action_secondaire: parsed.action_secondaire ? String(parsed.action_secondaire).slice(0, 300) : null,
        score_besoin: clampScore(parsed.score_besoin),
        score_creativite: clampScore(parsed.score_creativite),
        score_seo: clampScore(parsed.score_seo),
        score_commercial: clampScore(parsed.score_commercial),
        score_priorite: clampScore(parsed.score_priorite),
        sensible: Boolean(parsed.sensible),
        justification: String(parsed.justification ?? "").slice(0, 2000),
        prochaine_etape: parsed.prochaine_etape ? String(parsed.prochaine_etape).slice(0, 500) : null,
        model: prompt.model || "google/gemini-2.5-flash",
      };

      const { data: inserted, error: insErr } = await (admin as any)
        .from("editorial_recommendations")
        .insert(row)
        .select("id")
        .single();
      if (insErr) {
        console.error("[editorial-engine] insert error", insErr);
        results.push({ label: c.label, status: `erreur insertion : ${insErr.message}` });
      } else {
        results.push({ label: c.label, status: "créée", id: inserted.id });
      }
    }

    return json({
      ok: true,
      embedded_articles: embedded,
      candidates_found: candidates.length,
      processed: toProcess.length,
      remaining: Math.max(0, candidates.length - toProcess.length),
      sources_disponibles: available,
      results,
    });
  } catch (error) {
    await reportEdgeError(error, { fn: "editorial-engine" });
    console.error("[editorial-engine] error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
