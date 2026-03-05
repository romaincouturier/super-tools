import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const { action, reclamation } = await req.json();

    if (!action || !reclamation) {
      return createErrorResponse("Missing action or reclamation data", 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createErrorResponse("LOVABLE_API_KEY is not configured", 500);
    }

    let systemPrompt = `Tu es un assistant interne pour un petit organisme de formation (un seul formateur) qui gère les réclamations clients conformément à l'indicateur 31 de Qualiopi.
Tu dois rester simple, concret et professionnel. Tes réponses sont en français.
Contexte : organisme de très petite taille, peu de réclamations mais nécessité de prouver que le processus existe et est appliqué.`;

    let userPrompt = "";

    switch (action) {
      case "analyze":
        userPrompt = `Analyse cette réclamation et fournis :
1. Une analyse de la situation (contexte, causes possibles)
2. Des questions complémentaires à se poser
3. Des actions correctives suggérées (adaptations, geste commercial, etc.)
4. Un délai de réponse recommandé

Réclamation :
- Client : ${reclamation.client_name || "Non renseigné"}
- Canal : ${reclamation.canal || "Non renseigné"}
- Type : ${reclamation.problem_type || "Non renseigné"}
- Gravité : ${reclamation.severity || "Non renseignée"}
- Description : ${reclamation.description || "Non renseignée"}`;
        break;

      case "draft_response":
        userPrompt = `Rédige un message de réponse professionnel et empathique pour cette réclamation.
Le message doit :
- Accuser réception de la réclamation
- Montrer de l'empathie et de la compréhension
- Expliquer les actions qui seront/ont été prises
- Proposer un suivi si nécessaire
- Rester concis (10-15 lignes max)

Réclamation :
- Client : ${reclamation.client_name || "Non renseigné"}
- Type : ${reclamation.problem_type || "Non renseigné"}
- Gravité : ${reclamation.severity || "Non renseignée"}
- Description : ${reclamation.description || "Non renseignée"}
${reclamation.actions_decided ? `- Actions décidées : ${reclamation.actions_decided}` : ""}`;
        break;

      case "qualiopi_summary":
        userPrompt = `Génère un résumé "Qualiopi-friendly" de cette réclamation en 3 à 5 lignes maximum.
Le résumé doit montrer clairement :
1. Le problème initial
2. Ce que l'organisme a fait pour le traiter
3. Le résultat pour le client
4. Ce qui a éventuellement été amélioré dans l'offre ou l'organisation

Réclamation :
- Date : ${reclamation.date_reclamation || "Non renseignée"}
- Client : ${reclamation.client_name || "Non renseigné"}
- Type : ${reclamation.problem_type || "Non renseigné"}
- Gravité : ${reclamation.severity || "Non renseignée"}
- Description : ${reclamation.description || "Non renseignée"}
- Actions décidées : ${reclamation.actions_decided || "Non renseignées"}
- Réponse envoyée : ${reclamation.response_sent || "Non renseignée"}
- Statut : ${reclamation.status || "Non renseigné"}`;
        break;

      case "annual_report":
        userPrompt = `Génère un bilan annuel des réclamations à partir des données suivantes.
Le bilan doit :
1. Lister les réclamations reçues (nombre, types, gravités)
2. Identifier les récurrences (mêmes types de problèmes)
3. Suggérer 2-3 pistes d'amélioration à intégrer dans le plan d'amélioration continue
4. Conclure avec une appréciation globale

Données : ${JSON.stringify(reclamation)}`;
        break;

      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const response = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return createErrorResponse("Trop de requêtes, veuillez réessayer dans un instant.", 429);
      }
      if (response.status === 402) {
        return createErrorResponse("Crédits IA insuffisants.", 402);
      }
      return createErrorResponse("AI gateway error", 500);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    const resultKey = action === "analyze" ? "analysis" : action === "draft_response" ? "draft" : action === "qualiopi_summary" ? "summary" : "report";

    return createJsonResponse({ [resultKey]: content });
  } catch (e) {
    console.error("reclamation-ai-assist error:", e);
    return createErrorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
