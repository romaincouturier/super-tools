/**
 * generate-transcript-title
 *
 * Génère un titre court via Lovable AI Gateway et le stocke dans
 * `transcripts.ai_title`. Utilisé à la fois par `assemblyai-webhook`
 * (génération automatique à la réception du transcript) et par le
 * bouton "Régénérer le titre" dans l'UI.
 *
 * Auth :
 * - Si la requête contient un header `x-internal-secret` correspondant
 *   au `SUPABASE_SERVICE_ROLE_KEY`, on autorise sans JWT (appel webhook).
 * - Sinon, requiert un JWT (utilisateur connecté).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!LOVABLE_API_KEY) {
    return json({ error: "LOVABLE_API_KEY missing" }, 500);
  }

  let body: { transcript_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const transcriptId = body.transcript_id;
  if (!transcriptId) return json({ error: "Missing transcript_id" }, 400);

  // Auth : interne (webhook) ou utilisateur connecté
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
    .eq("kind", "title")
    .maybeSingle();

  if (!prompt) return json({ error: "Prompt 'title' introuvable" }, 500);

  const excerpt = (t.raw_text as string).slice(0, 3000);
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
    console.error("[generate-transcript-title] AI error", aiRes.status, errText);
    if (aiRes.status === 429) return json({ error: "Rate limit IA, réessayez plus tard." }, 429);
    if (aiRes.status === 402) return json({ error: "Crédits IA épuisés." }, 402);
    return json({ error: "Erreur IA" }, 500);
  }

  const aiJson = await aiRes.json();
  let title = (aiJson?.choices?.[0]?.message?.content ?? "").trim();
  // Nettoyage : strip guillemets / ponctuation finale
  title = title.replace(/^["'«»]+|["'«»]+$/g, "").replace(/[.!?]+$/, "").trim();
  // Limite raisonnable
  if (title.length > 120) title = title.slice(0, 120).trim();

  if (!title) return json({ error: "Titre vide généré" }, 500);

  const { error: updErr } = await (admin as any)
    .from("transcripts")
    .update({ ai_title: title })
    .eq("id", transcriptId);
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ ok: true, ai_title: title });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
