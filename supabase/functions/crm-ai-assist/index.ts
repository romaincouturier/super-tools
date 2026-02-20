import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

interface CrmAiRequest {
  action: "analyze_exchanges" | "generate_quote_description" | "improve_email_subject" | "improve_email_body" | "suggest_next_action";
  card_data: {
    title?: string;
    description?: string;
    company?: string;
    first_name?: string;
    last_name?: string;
    service_type?: "formation" | "mission" | null;
    estimated_value?: number;
    comments?: Array<{ content: string; author_email: string; created_at: string }>;
    brief_questions?: Array<{ question: string; answered: boolean }>;
    // Email improvement fields
    subject?: string;
    body?: string;
    context?: string;
    // Next action suggestion fields
    confidence_score?: number | null;
    current_next_action?: string;
    days_in_pipeline?: number | null;
    activities?: Array<{ action_type: string; new_value?: string; created_at: string }>;
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

      case "improve_email_subject": {
        const systemPrompt = `Tu es un expert en copywriting commercial pour SuperTilt, organisme de formation professionnelle certifié Qualiopi.
Tu réécris les objets d'emails pour maximiser le taux d'ouverture : clairs, spécifiques, qui créent une légère urgence ou curiosité sans être racoleurs.
Tu réponds UNIQUEMENT avec l'objet amélioré, sans explication ni guillemets.`;

        const subject = card_data.subject || "";
        const company = card_data.company || "";
        const firstName = card_data.first_name || "";

        const userPrompt = `Réécris cet objet d'email pour qu'il soit plus percutant et incitatif à l'ouverture :
Objet actuel : "${subject}"
${company ? `Entreprise : ${company}` : ""}
${firstName ? `Prénom du contact : ${firstName}` : ""}

Contraintes :
- Maximum 55 caractères
- Ton professionnel mais direct et engageant
- Pas de point d'exclamation ni de majuscules abusives
- Peut contenir le prénom ou l'entreprise si pertinent
- Crée une légère curiosité ou sentiment d'urgence subtile
- Spécifique à la formation/prestation concernée

Exemples de bons objets : "Votre devis – formations facilitation graphique", "Votre inscription en attente – SuperTilt", "Suite à notre échange – quelques précisions"

Réponds uniquement avec l'objet amélioré.`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      case "improve_email_body": {
        const systemPrompt = `Tu es un expert en rédaction d'emails commerciaux B2B pour SuperTilt, organisme de formation professionnelle certifié Qualiopi.
Tu réécris les emails pour qu'ils soient plus percutants, chaleureux et orientés action.
Ton style : phrases courtes et rythmées, direct mais bienveillant, focus sur la valeur pour le client, appel à l'action clair.
Tu réponds UNIQUEMENT avec le contenu HTML amélioré, sans explication.`;

        const body = card_data.body || "";
        const subject = card_data.subject || "";
        const company = card_data.company || "";
        const firstName = card_data.first_name || "";
        const emailContext = card_data.context || "";

        const userPrompt = `Réécris ce corps d'email pour le rendre plus percutant et efficace commercialement :

Objet : "${subject}"
${company ? `Entreprise : ${company}` : ""}
${firstName ? `Contact : ${firstName}` : ""}
${emailContext ? `\nContexte de l'opportunité :\n${emailContext}` : ""}

Email original (HTML) :
${body}

Objectifs de la réécriture :
- Phrases plus courtes et rythmées (éviter les longues énumérations)
- Ton direct mais chaleureux, comme si on parlait à quelqu'un qu'on connaît
- Mettre en avant ce que ça apporte au client (bénéfices > caractéristiques)
- Terminer par un appel à l'action clair et simple (ex: "Dites-moi si vous avez des questions", "Êtes-vous disponible pour en discuter ?")
- Conserver le tutoiement/vouvoiement du message original
- Conserver toutes les informations importantes
- Format HTML avec balises <p>
- Ne PAS ajouter de signature ni modifier les formules de politesse existantes

Réponds uniquement avec le HTML amélioré.`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      case "suggest_next_action": {
        const systemPrompt = `Tu es un coach commercial expert pour SuperTilt, organisme de formation professionnelle.
Tu analyses le contexte d'une opportunité CRM pour suggérer la prochaine action concrète à effectuer.

Règles :
- Propose UNE SEULE action concrète et réalisable
- Sois spécifique (pas de "relancer le client" mais "envoyer un email de suivi avec le devis mis à jour")
- Tiens compte de l'ancienneté du deal, de la confiance, et de l'historique d'activité
- Maximum 2 phrases
- En français
- Pas de préambule, directement l'action`;

        let nextActionContext = context;
        if (card_data.confidence_score != null) {
          nextActionContext += `\n**Indice de confiance:** ${card_data.confidence_score}%\n`;
        }
        if (card_data.days_in_pipeline != null) {
          nextActionContext += `**Jours dans le pipeline:** ${card_data.days_in_pipeline}\n`;
        }
        if (card_data.current_next_action) {
          nextActionContext += `**Action précédente:** ${card_data.current_next_action}\n`;
        }
        if (card_data.activities && card_data.activities.length > 0) {
          nextActionContext += `\n## Dernières activités\n`;
          card_data.activities.forEach((a) => {
            nextActionContext += `- [${a.created_at}] ${a.action_type}${a.new_value ? ` → ${a.new_value}` : ""}\n`;
          });
        }

        const userPrompt = `Quelle est la meilleure prochaine action à effectuer pour faire avancer cette opportunité ?\n\n${nextActionContext}`;

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
