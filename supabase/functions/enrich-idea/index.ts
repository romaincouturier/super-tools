import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { embedText } from "../_shared/embeddings.ts";
import { aiChat } from "../_shared/ai.ts";

/**
 * Enrichissement d'une idée en tâche de fond (lot 3) :
 *  - embedding (anti-doublon / clustering)
 *  - catégorie, impact, effort, résumé (via le helper provider-agnostique)
 *
 * Appel : { id } pour une idée, ou { batch: true } pour traiter les idées
 * non encore enrichies (cron de rattrapage).
 */

interface IdeaRow {
  id: string;
  title: string;
  description: string | null;
}

const ENRICH_SCHEMA_PROMPT = `Tu analyses une idée interne d'amélioration produit/process.
Réponds UNIQUEMENT en JSON valide (sans markdown) avec :
- "category": une catégorie courte en français (ex: "Produit", "UX", "Process", "Commercial", "Technique", "Pédagogie")
- "impact": "faible" | "moyen" | "fort"
- "effort": "faible" | "moyen" | "fort"
- "summary": une reformulation claire en une phrase`;

async function enrichOne(supabase: ReturnType<typeof getSupabaseClient>, idea: IdeaRow) {
  const text = `${idea.title}\n\n${idea.description ?? ""}`.trim();

  const [embedding, aiRaw] = await Promise.all([
    embedText(text),
    aiChat({
      system: ENRICH_SCHEMA_PROMPT,
      messages: [{ role: "user", content: text }],
      tier: "fast",
      temperature: 0.2,
    }).catch((e) => {
      console.error("[enrich-idea] aiChat failed", e);
      return "";
    }),
  ]);

  let ai: { category?: string; impact?: string; effort?: string; summary?: string } = {};
  if (aiRaw) {
    try {
      const clean = aiRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      ai = JSON.parse(clean);
    } catch {
      console.error("[enrich-idea] JSON parse failed:", aiRaw.slice(0, 200));
    }
  }

  const update: Record<string, unknown> = { ai_enriched_at: new Date().toISOString() };
  if (embedding) update.embedding = embedding;
  if (ai.category) update.ai_category = String(ai.category).slice(0, 60);
  if (ai.impact) update.ai_impact = String(ai.impact).toLowerCase();
  if (ai.effort) update.ai_effort = String(ai.effort).toLowerCase();
  if (ai.summary) update.ai_summary = String(ai.summary).slice(0, 500);

  const { error } = await supabase.from("ideas").update(update).eq("id", idea.id);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));

    if (body.batch) {
      const { data } = await supabase
        .from("ideas")
        .select("id, title, description")
        .is("ai_enriched_at", null)
        .limit(25);
      const rows = (data ?? []) as IdeaRow[];
      let ok = 0;
      for (const idea of rows) {
        try { await enrichOne(supabase, idea); ok++; } catch (e) { console.error("[enrich-idea] batch item failed", e); }
      }
      return createJsonResponse({ enriched: ok, total: rows.length });
    }

    if (!body.id) return createErrorResponse("id requis", 400);
    const { data, error } = await supabase
      .from("ideas")
      .select("id, title, description")
      .eq("id", body.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return createErrorResponse("Idée introuvable", 404);

    await enrichOne(supabase, data as IdeaRow);
    return createJsonResponse({ enriched: 1 });
  } catch (err) {
    console.error("[enrich-idea] error", err);
    return createErrorResponse(err instanceof Error ? err.message : "Erreur inconnue", 500, { cause: err, fn: "enrich-idea" });
  }
});
