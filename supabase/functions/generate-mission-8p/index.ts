/**
 * generate-mission-8p
 *
 * Generates a structured "8P" canvas page for a mission, by compiling selected
 * sources (linked CRM opportunity + selected mission pages) and asking the
 * Lovable AI Gateway to synthesize them under 8 sections:
 *   Present, Purpose, Public, Process, Product, Pitfalls, Preparation, Prerequisites.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

interface RequestBody {
  mission_id: string;
  include_crm_card?: boolean;
  /** Optional explicit CRM card id to use as source (overrides linked_mission_id lookup). */
  crm_card_id?: string;
  page_ids?: string[];
}

const SYSTEM_PROMPT = `Tu es un consultant senior. À partir des sources fournies (description d'opportunité CRM + extraits de pages d'une mission), produis un canevas "9P" structuré en HTML propre prêt à coller dans un éditeur de texte enrichi.

Structure obligatoire (dans cet ordre) :
1. Present — Contexte
2. Purpose — Objectifs
3. Public — Personnes
4. Process — Agenda
5. Product — Livrable
6. Pitfalls — Risques
7. Preparation — Préparation
8. Prerequisites — Prérequis logistiques
9. Puzzle — Questions ouvertes / zones d'ombre

Règles générales :
- Pour chaque section : un <h2> avec le nom court (ex: "Present — Contexte"), suivi d'un ou plusieurs paragraphes <p> et/ou listes <ul><li>.
- Utilise UNIQUEMENT les informations présentes dans les sources. Si une section n'a pas d'information, écris une seule phrase neutre du type "À compléter — pas d'information dans les sources fournies."
- Ne pas inventer.
- Ton clair, synthétique, professionnel, en français, tutoiement.
- Pas de balises <html>, <body> ou <head>. Pas de markdown : uniquement du HTML.

Règles spécifiques :
- Section "Preparation — Préparation" : organise les items en 3 sous-sections via <h3> dans cet ordre : "Client", "SuperTilt", "Autres". Chaque sous-section contient une liste de cases à cocher au format TipTap TaskList :
  <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Item à préparer</p></div></li></ul>
  Si une sous-section n'a aucun item dans les sources, écris : <p>À compléter — pas d'information dans les sources fournies.</p>
- Section "Puzzle — Questions ouvertes / zones d'ombre" : regroupe TOUTES les sections nommées "Puzzle" (insensible à la casse) trouvées dans les sources, ainsi que les questions ouvertes, hypothèses non vérifiées, ou zones d'ombre identifiées. Format : <ul><li>...</li></ul>.`;


function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const body: RequestBody = await req.json();
    if (!body.mission_id || typeof body.mission_id !== "string") {
      return createErrorResponse("mission_id requis", 400);
    }

    const supabase = getSupabaseClient();

    // 1. Mission
    const { data: mission, error: missionErr } = await supabase
      .from("missions")
      .select("id, title, description, client_name, client_contact, location")
      .eq("id", body.mission_id)
      .maybeSingle();
    if (missionErr) throw missionErr;
    if (!mission) return createErrorResponse("Mission introuvable", 404);

    const sources: Array<{ label: string; content: string }> = [];

    sources.push({
      label: "Mission (métadonnées)",
      content: `Titre: ${mission.title || ""}
Client: ${mission.client_name || ""}
Contact: ${mission.client_contact || ""}
Lieu: ${mission.location || ""}
Description: ${mission.description || ""}`,
    });

    // 2. CRM card (explicit id takes priority, otherwise look up via linked_mission_id)
    if (body.include_crm_card || body.crm_card_id) {
      let query = supabase
        .from("crm_cards")
        .select("title, description_html, first_name, last_name, company, email, service_type, raw_input, brief_questions")
        .limit(1);
      if (body.crm_card_id) {
        query = query.eq("id", body.crm_card_id);
      } else {
        query = query.eq("linked_mission_id", body.mission_id);
      }
      const { data: cards } = await query;
      const card = cards?.[0];
      if (card) {
        const briefText = Array.isArray(card.brief_questions)
          ? (card.brief_questions as Array<{ question?: string; answer?: string }>)
              .map((q) => `Q: ${q.question || ""}\nR: ${q.answer || ""}`)
              .join("\n")
          : "";
        sources.push({
          label: `Opportunité CRM: ${card.title || ""}`,
          content: `Contact: ${card.first_name || ""} ${card.last_name || ""} — ${card.company || ""} — ${card.email || ""}
Type de service: ${card.service_type || ""}
Description: ${htmlToText(card.description_html as string)}
Brief initial: ${card.raw_input || ""}
Questions/Réponses brief: ${briefText}`,
        });
      }
    }

    // 3. Selected pages
    if (body.page_ids && body.page_ids.length > 0) {
      const { data: pages } = await supabase
        .from("mission_pages")
        .select("id, title, content")
        .eq("mission_id", body.mission_id)
        .in("id", body.page_ids);
      for (const p of pages || []) {
        sources.push({
          label: `Page: ${p.title || "Sans titre"}`,
          content: htmlToText(p.content as string),
        });
      }
    }

    // 4. Build prompt
    const userPrompt = `Voici les sources à compiler dans le canevas 9P :

${sources.map((s, i) => `--- SOURCE ${i + 1} : ${s.label} ---\n${s.content}`).join("\n\n")}

Génère maintenant le canevas 9P complet en HTML.`;

    // 5. Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return createErrorResponse("LOVABLE_API_KEY manquant", 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return createErrorResponse("Limite de requêtes IA atteinte, réessaie dans quelques instants.", 429);
      if (aiResp.status === 402) return createErrorResponse("Crédits IA épuisés. Ajoute des crédits dans les paramètres Lovable Cloud.", 402);
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return createErrorResponse("Erreur passerelle IA", 500);
    }

    const aiData = await aiResp.json();
    const html = aiData?.choices?.[0]?.message?.content || "";

    if (!html) return createErrorResponse("Réponse IA vide", 500);

    return createJsonResponse({ success: true, html, sources_count: sources.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    console.error("[generate-mission-8p] error:", msg);
    return createErrorResponse(msg, 500);
  }
});
