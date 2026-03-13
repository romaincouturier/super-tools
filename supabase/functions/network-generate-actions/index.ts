import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Tu es un coach en développement de réseau professionnel pour formateurs indépendants.

On te donne :
- La fiche de positionnement de l'utilisateur (pitch, compétences, cible)
- Sa liste de contacts avec leur chaleur (hot/warm/cold), contexte et dernière interaction

Ta mission : générer un plan d'actions réseau pour la semaine. Pour chaque action :
1. Choisis le contact le plus pertinent à recontacter (priorité aux contacts chauds/tièdes sans interaction récente)
2. Propose un type d'action : "linkedin_message", "email", "phone_call", "coffee_invite", "share_content"
3. Rédige un brouillon de message personnalisé (court, naturel, pas commercial)
4. Explique pourquoi cette action est pertinente maintenant

Règles :
- Génère entre 3 et 5 actions maximum
- Ne propose pas d'action pour un contact qui a une interaction dans les 7 derniers jours
- Adapte le ton au contexte de la relation
- Les messages doivent être prêts à envoyer (pas de placeholder [NOM])
- Réponds en français
- Réponds UNIQUEMENT avec du JSON valide, sans markdown autour

Format de réponse :
[
  {
    "contact_id": "uuid du contact",
    "contact_name": "Nom",
    "action_type": "linkedin_message",
    "reason": "Explication courte de pourquoi maintenant",
    "message_draft": "Le message prêt à envoyer"
  }
]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { positioning, contacts } = await req.json();

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun contact fourni" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const userPrompt = `Voici mon positionnement :
${JSON.stringify(positioning, null, 2)}

Voici mes contacts :
${JSON.stringify(contacts, null, 2)}

Date du jour : ${new Date().toISOString().split("T")[0]}

Génère mon plan d'actions réseau pour cette semaine.`;

    let answer: string;

    if (!anthropicKey) {
      const lovableResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 3000,
          temperature: 0.4,
        }),
      });
      const lovableData = await lovableResponse.json();
      answer = lovableData.choices?.[0]?.message?.content || "[]";
    } else {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          temperature: 0.4,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      const data = await response.json();
      answer = data.content?.[0]?.text || "[]";
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let actions;
    try {
      const jsonMatch = answer.match(/\[[\s\S]*\]/);
      actions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      actions = [];
    }

    return new Response(JSON.stringify({ actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Network Generate Actions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
