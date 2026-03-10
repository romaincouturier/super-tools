import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { synthesis, instructions, clientContext } = await req.json();
    if (!synthesis) {
      return createErrorResponse("Le champ 'synthesis' est requis", 400);
    }

    const systemPrompt = `Tu es un coach commercial senior, expert en vente de prestations de conseil et formation professionnelle pour des indépendants et TPE.

Ton rôle est de CHALLENGER la proposition commerciale pour l'améliorer et maximiser la valeur apportée au client ET au prestataire.

Tu reçois :
1. La synthèse de l'opportunité (analyse du besoin client)
2. Les instructions/notes dictées par le consultant (sa vision de la proposition)
3. Le contexte client (informations CRM)

ANALYSE CRITIQUE :
- Identifie les opportunités manquées (upsell, cross-sell, services complémentaires)
- Détecte les incohérences entre le besoin client et la proposition
- Propose des angles de valorisation supplémentaires
- Challenge le pricing si les instructions en contiennent
- Suggère des formulations plus impactantes
- Identifie les risques commerciaux (scope trop large, engagement insuffisant, etc.)

RÈGLES :
- Sois direct, constructif et bienveillant — comme un associé qui veut ton succès
- Donne des recommandations ACTIONABLES et CONCRÈTES
- Structure ta réponse de façon claire
- Rédige en français professionnel
- ÉCRIS DE MANIÈRE DENSE ET CONCISE

FORMAT DE SORTIE — HTML simple (PAS de markdown) :

<h3>🎯 Points forts de ta proposition</h3>
<ul><li>Ce qui est bien et à garder</li></ul>

<h3>⚡ Axes d'amélioration</h3>
<ul><li>Ce qui peut être amélioré avec suggestion concrète</li></ul>

<h3>💡 Opportunités identifiées</h3>
<ul><li>Services ou options supplémentaires à proposer</li></ul>

<h3>⚠️ Points de vigilance</h3>
<ul><li>Risques ou éléments à clarifier</li></ul>

<h3>🚀 Recommandation finale</h3>
<p>Résumé actionable en 2-3 phrases</p>

IMPORTANT : Retourne UNIQUEMENT le HTML, sans wrapper markdown.`;

    const userContent = [
      `=== SYNTHÈSE DE L'OPPORTUNITÉ ===\n${synthesis}`,
      instructions ? `\n=== NOTES/INSTRUCTIONS DU CONSULTANT ===\n${instructions}` : "",
      clientContext ? `\n=== CONTEXTE CLIENT (CRM) ===\n${clientContext}` : "",
    ].filter(Boolean).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      if (response.status === 429) {
        return createErrorResponse("Trop de requêtes, réessayez dans quelques instants", 429);
      }
      if (response.status === 402) {
        return createErrorResponse("Crédits IA insuffisants", 402);
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    let raw = (result.choices?.[0]?.message?.content || "").trim();
    raw = raw.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    return createJsonResponse({ challenge: raw });
  } catch (error: unknown) {
    console.error("Error in commercial-challenge:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
