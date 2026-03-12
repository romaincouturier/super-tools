import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const { description } = await req.json();

    if (!description || typeof description !== "string" || !description.trim()) {
      return createErrorResponse("La description est requise.", 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createErrorResponse("LOVABLE_API_KEY is not configured", 500);
    }

    const systemPrompt = `Tu es un assistant de tri et structuration de tickets support pour une application SaaS e-learning.
L'utilisateur soumet une description libre (parfois vague). Tu dois :
1. Déterminer s'il s'agit d'un **bug** ou d'une **évolution** (demande de fonctionnalité / amélioration).
2. Attribuer une **priorité** parmi : low, medium, high, critical.
3. Générer un **titre** court et clair (max 80 caractères).
4. Produire une analyse structurée selon le type.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire.

Si c'est un **bug**, réponds avec ce schéma exact :
{
  "type": "bug",
  "title": "...",
  "priority": "low|medium|high|critical",
  "constat": "Description factuelle du problème observé",
  "reproduction": "Étapes probables pour reproduire le bug (si déductibles de la description, sinon indiquer 'Non précisé par l'utilisateur')",
  "situation_desiree": "Ce qui devrait se passer normalement",
  "procedure_test": "Comment vérifier que le bug est corrigé"
}

Si c'est une **évolution**, réponds avec ce schéma exact :
{
  "type": "evolution",
  "title": "...",
  "priority": "low|medium|high|critical",
  "user_stories": "Une ou plusieurs user stories au format 'En tant que [rôle], je veux [action] afin de [bénéfice]'",
  "criteres_acceptation": "Liste de critères d'acceptation vérifiables",
  "impact_produit": "Impact supposé pour le produit (UX, rétention, valeur ajoutée...)"
}`;

    const userPrompt = `Voici la description soumise par l'utilisateur :\n\n${description.trim()}`;

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
        return createErrorResponse("Trop de requêtes IA, veuillez réessayer dans un instant.", 429);
      }
      if (response.status === 402) {
        return createErrorResponse("Crédits IA insuffisants.", 402);
      }
      return createErrorResponse("Erreur du service IA", 500);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response from AI
    let analysis;
    try {
      // Strip potential markdown fences
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return createErrorResponse("L'IA n'a pas retourné un format valide. Veuillez réessayer.", 500);
    }

    // Validate required fields
    if (!analysis.type || !["bug", "evolution"].includes(analysis.type)) {
      analysis.type = "bug";
    }
    if (!analysis.title) {
      analysis.title = "Ticket sans titre";
    }
    if (!analysis.priority || !["low", "medium", "high", "critical"].includes(analysis.priority)) {
      analysis.priority = "medium";
    }

    return createJsonResponse({ analysis });
  } catch (e) {
    console.error("support-analyze-ticket error:", e);
    return createErrorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
