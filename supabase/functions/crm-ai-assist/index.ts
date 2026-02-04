import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

interface CrmAiRequest {
  action: "analyze_exchanges" | "generate_quote_description";
  card_data: {
    title: string;
    description: string;
    company?: string;
    first_name?: string;
    last_name?: string;
    service_type?: "formation" | "mission" | null;
    estimated_value?: number;
    comments?: Array<{ content: string; author_email: string; created_at: string }>;
    brief_questions?: Array<{ question: string; answered: boolean }>;
  };
}

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();
  return result.content[0]?.text || "";
}

function buildContextFromCard(cardData: CrmAiRequest["card_data"]): string {
  let context = `# Opportunité CRM\n\n`;
  context += `**Titre:** ${cardData.title}\n`;

  if (cardData.company) {
    context += `**Entreprise:** ${cardData.company}\n`;
  }

  if (cardData.first_name || cardData.last_name) {
    context += `**Contact:** ${[cardData.first_name, cardData.last_name].filter(Boolean).join(" ")}\n`;
  }

  if (cardData.service_type) {
    context += `**Type:** ${cardData.service_type === "formation" ? "Formation" : "Mission"}\n`;
  }

  if (cardData.estimated_value) {
    context += `**Valeur estimée:** ${cardData.estimated_value}€\n`;
  }

  context += `\n## Description / Notes\n${cardData.description || "(Aucune description)"}\n`;

  if (cardData.brief_questions && cardData.brief_questions.length > 0) {
    context += `\n## Questions du brief\n`;
    cardData.brief_questions.forEach((q, i) => {
      context += `${i + 1}. ${q.question} ${q.answered ? "(Répondu)" : "(En attente)"}\n`;
    });
  }

  if (cardData.comments && cardData.comments.length > 0) {
    context += `\n## Historique des commentaires\n`;
    cardData.comments.forEach((c) => {
      context += `- [${c.created_at}] ${c.author_email}: ${c.content}\n`;
    });
  }

  return context;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);

    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { action, card_data } = await req.json() as CrmAiRequest;

    if (!action || !card_data) {
      return createErrorResponse("action et card_data sont requis", 400);
    }

    const context = buildContextFromCard(card_data);
    let result: string;

    switch (action) {
      case "analyze_exchanges": {
        const systemPrompt = `Tu es un expert en analyse commerciale pour un organisme de formation professionnelle (SuperTilt).

Tu analyses les échanges et informations d'une opportunité CRM pour fournir une synthèse stratégique.

Ton analyse doit être :
- Concise mais complète
- Orientée action
- En français
- Structurée avec des sections claires`;

        const userPrompt = `Analyse cette opportunité commerciale et fournis :

1. **Résumé de la situation** : Synthèse en 2-3 phrases du contexte et de la demande
2. **Points clés identifiés** : Les éléments importants à retenir
3. **Signaux positifs** : Ce qui semble favorable à la conclusion
4. **Points d'attention** : Risques ou éléments à clarifier
5. **Prochaines étapes recommandées** : Actions concrètes à entreprendre

${context}`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      case "generate_quote_description": {
        const systemPrompt = `Tu es un rédacteur commercial expert pour SuperTilt, organisme de formation professionnelle certifié Qualiopi.

Tu rédiges des descriptions professionnelles pour les devis de formation/prestation.

Le texte doit être :
- Professionnel et structuré
- Adapté à un devis commercial
- Mettant en valeur la prestation
- En français`;

        const userPrompt = `À partir des informations de cette opportunité, génère une description professionnelle à inclure dans un devis.

La description doit inclure :
- Un paragraphe d'introduction contextualisant la demande
- Les objectifs de la prestation
- Le périmètre de l'intervention
- Les livrables ou résultats attendus

Adapte le vocabulaire selon qu'il s'agit d'une formation ou d'une mission.

${context}

Génère uniquement la description, sans titre ni en-tête.`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      default:
        return createErrorResponse("Action non reconnue", 400);
    }

    return createJsonResponse({ result });
  } catch (error: unknown) {
    console.error("Error in crm-ai-assist:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(errorMessage);
  }
});
