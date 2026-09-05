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
import { logLovableUsage } from "../_shared/api-usage.ts";
import { parseAiJson, truncateForLog, STRICT_JSON_INSTRUCTION } from "../_shared/ai-json.ts";

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

    /**
     * Un échec doit laisser une trace : sans compteur, `editorial_qualification`
     * reste NULL et le cron de backfill réanalyse le même transcript toutes les
     * 10 minutes indéfiniment. Au-delà de MAX_ATTEMPTS le transcript sort du lot.
     */
    const failed = async (message: string, status: number) => {
      await (admin as any).rpc("record_editorial_analysis_failure", {
        p_transcript_id: transcriptId,
        p_error: message.slice(0, 500),
      });
      return json({ error: message }, status);
    };

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
    if (!prompt) return failed("Prompt 'editorial' introuvable (migration non appliquée ?)", 500);

    // 30k caractères ≈ largement assez pour qualifier ; évite les dépassements.
    const excerpt = (t.raw_text as string).slice(0, 30000);
    const userPrompt = applyTemplate(prompt.user_prompt_template, { transcript: excerpt });

    async function callAi(system: string) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: prompt.model || "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[analyze-transcript-editorial] AI error", res.status, errText);
        return { ok: false as const, status: res.status };
      }

      const aiJson = await res.json();
      await logLovableUsage({
        origin: "analyze-transcript-editorial",
        trigger: "cron",
        data: aiJson,
      });
      return { ok: true as const, text: String(aiJson?.choices?.[0]?.message?.content ?? "").trim() };
    }

    const aiError = (status: number) => {
      if (status === 429) return json({ error: "Rate limit IA, réessayez plus tard." }, 429);
      if (status === 402) return json({ error: "Crédits IA épuisés." }, 402);
      return failed(`Erreur IA ${status}`, 500);
    };

    const first = await callAi(prompt.system_prompt);
    if (!first.ok) return aiError(first.status);

    let parsed = parseAiJson<Record<string, unknown>>(first.text);

    if (!parsed) {
      console.error(
        "[analyze-transcript-editorial] unparseable AI response:",
        truncateForLog(first.text),
      );
      const retry = await callAi(`${prompt.system_prompt}\n\n${STRICT_JSON_INSTRUCTION}`);
      if (!retry.ok) return aiError(retry.status);
      parsed = parseAiJson<Record<string, unknown>>(retry.text);
      if (!parsed) {
        console.error(
          "[analyze-transcript-editorial] retry also unparseable:",
          truncateForLog(retry.text),
        );
        return failed(
          "L'IA n'a pas réussi à structurer l'analyse de cette transcription. Réessayez dans un instant.",
          422,
        );
      }
    }

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
        editorial_analysis_attempts: 0,
        editorial_analysis_error: null,
      })
      .eq("id", transcriptId);
    if (updErr) return failed(updErr.message, 500);

    return json({ ok: true, qualification, analysis });
  } catch (error) {
    await reportEdgeError(error, { fn: "analyze-transcript-editorial" });
    console.error("[analyze-transcript-editorial] error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
