/**
 * analyze-transcript-editorial (ST-2026-0215)
 *
 * Produit la fiche éditoriale IA d'une transcription : qualification,
 * univers, type de matière, résumé éditorial (5 lignes max), 3-5 signaux,
 * risque de confidentialité. Stocke le résultat dans
 * transcripts.editorial_qualification / editorial_analysis.
 *
 * Déclenchée automatiquement quand un transcript passe à "ready"
 * (poll-drive-transcripts, fireflies-webhook, assemblyai-webhook) et
 * relançable depuis l'UI.
 *
 * Auth : header x-internal-secret (appels internes) ou JWT utilisateur.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const QUALIFICATIONS = new Set([
  "pro_exploitable", "pro_archiver", "personnel_hors_sujet",
  "sensible_confidentiel", "non_exploitable",
]);
const UNIVERS = new Set([
  "facilitation_graphique", "facilitation_intelligence_collective",
  "agilite_produit_organisation", "ia", "formation_pedagogie",
  "gestion_temps_priorites", "autre",
]);
const TYPES_MATIERE = new Set([
  "question_client_frequente", "probleme_terrain", "objection_commerciale",
  "feedback_formation", "temoignage_potentiel", "cas_client_potentiel",
  "idee_article", "idee_newsletter", "idee_post_linkedin",
  "ressource_pedagogique", "aucun_potentiel",
]);
const RISQUES = new Set(["faible", "moyen", "fort"]);

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extrait le premier objet JSON d'une réponse IA (tolère les fences markdown). */
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

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

  try {
    let body: { transcript_id?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const transcriptId = body.transcript_id;
    if (!transcriptId) return json({ error: "Missing transcript_id" }, 400);

    // Auth : interne (webhook/poll) ou utilisateur connecté.
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
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: t, error: tErr } = await (admin as any)
      .from("transcripts")
      .select("id, raw_text")
      .eq("id", transcriptId)
      .single();
    if (tErr || !t) return json({ error: "Transcript introuvable" }, 404);
    if (!t.raw_text) return json({ error: "Transcript sans texte" }, 400);

    const { data: prompt } = await (admin as any)
      .from("transcript_ai_prompts")
      .select("system_prompt, user_prompt_template, model")
      .eq("kind", "editorial")
      .maybeSingle();
    if (!prompt) return json({ error: "Prompt 'editorial' introuvable (migration non appliquée ?)" }, 500);

    // 30k caractères ≈ largement assez pour qualifier ; évite les dépassements.
    const excerpt = (t.raw_text as string).slice(0, 30000);
    const userPrompt = applyTemplate(prompt.user_prompt_template, { transcript: excerpt });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
      console.error("[analyze-transcript-editorial] AI error", aiRes.status, errText);
      if (aiRes.status === 429) return json({ error: "Rate limit IA, réessayez plus tard." }, 429);
      if (aiRes.status === 402) return json({ error: "Crédits IA épuisés." }, 402);
      return json({ error: "Erreur IA" }, 500);
    }

    const aiJson = await aiRes.json();
    const content = (aiJson?.choices?.[0]?.message?.content ?? "").trim();
    const parsed = extractJson(content);
    if (!parsed) return json({ error: "Réponse IA non parsable" }, 500);

    // Validation stricte des énumérations, avec valeurs de repli prudentes.
    const qualification = QUALIFICATIONS.has(String(parsed.qualification))
      ? String(parsed.qualification)
      : "non_exploitable";
    const univers = UNIVERS.has(String(parsed.univers)) ? String(parsed.univers) : "autre";
    const typeMatiere = TYPES_MATIERE.has(String(parsed.type_matiere))
      ? String(parsed.type_matiere)
      : "aucun_potentiel";
    const risque = RISQUES.has(String(parsed.risque_confidentialite))
      ? String(parsed.risque_confidentialite)
      : "moyen";

    const isEditorial = qualification === "pro_exploitable";
    // Règle : pas d'idées éditoriales hors "pro exploitable" ; 5 signaux max.
    const resume = isEditorial ? String(parsed.resume_editorial ?? "").trim().slice(0, 1200) : "";
    const signaux = isEditorial
      ? (Array.isArray(parsed.signaux) ? parsed.signaux : [])
          .map((s: unknown) => String(s).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const typeFinal = isEditorial ? typeMatiere : "aucun_potentiel";

    const analysis = {
      univers,
      type_matiere: typeFinal,
      resume_editorial: resume,
      signaux,
      risque_confidentialite: risque,
      risque_justification: String(parsed.risque_justification ?? "").trim().slice(0, 300),
    };

    const { error: updErr } = await (admin as any)
      .from("transcripts")
      .update({
        editorial_qualification: qualification,
        editorial_analysis: analysis,
        editorial_analyzed_at: new Date().toISOString(),
      })
      .eq("id", transcriptId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, qualification, analysis });
  } catch (error) {
    await reportEdgeError(error, { fn: "analyze-transcript-editorial" });
    console.error("[analyze-transcript-editorial] error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
