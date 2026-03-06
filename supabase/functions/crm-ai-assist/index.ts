import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

interface CrmAiRequest {
  action: "analyze_exchanges" | "generate_quote_description" | "improve_email_subject" | "improve_email_body" | "cleanup_dictation" | "suggest_next_action" | "find_website" | "improve_template";
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
    activities?: Array<{ action_type: string; new_value?: string; created_at: string; actor_email?: string }>;
    // Rich context fields
    emails_sent?: Array<{ subject: string; body_html: string; sent_at: string; recipient_email: string }>;
    client_profile?: string;
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
      model: "claude-haiku-4-5-20251001",
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

  if (cardData.client_profile) {
    context += `\n## Profil client\n${cardData.client_profile}\n`;
  } else {
    if (cardData.company) {
      context += `**Entreprise:** ${cardData.company}\n`;
    }
    if (cardData.first_name || cardData.last_name) {
      context += `**Contact:** ${[cardData.first_name, cardData.last_name].filter(Boolean).join(" ")}\n`;
    }
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

  if (cardData.activities && cardData.activities.length > 0) {
    context += `\n## Historique d'activité\n`;
    cardData.activities.forEach((a) => {
      context += `- [${a.created_at}] ${a.action_type}${a.new_value ? ` → ${a.new_value}` : ""}${a.actor_email ? ` (${a.actor_email})` : ""}\n`;
    });
  }

  if (cardData.emails_sent && cardData.emails_sent.length > 0) {
    context += `\n## Emails envoyés\n`;
    cardData.emails_sent.forEach((e) => {
      // Strip HTML for context, keep it concise
      const plainBody = e.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const truncated = plainBody.length > 500 ? plainBody.substring(0, 500) + "…" : plainBody;
      context += `- [${e.sent_at}] À: ${e.recipient_email} | Objet: ${e.subject}\n  ${truncated}\n`;
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
Tu tiens compte du contexte complet de l'opportunité pour personnaliser l'objet.
Tu réponds UNIQUEMENT avec l'objet amélioré, sans explication ni guillemets.`;

        const subject = card_data.subject || "";

        const userPrompt = `Réécris cet objet d'email pour qu'il soit plus percutant et incitatif à l'ouverture :
Objet actuel : "${subject}"

${context}

Contraintes :
- Maximum 55 caractères
- Ton professionnel mais direct et engageant
- Pas de point d'exclamation ni de majuscules abusives
- Peut contenir le prénom ou l'entreprise si pertinent
- Crée une légère curiosité ou sentiment d'urgence subtile
- Spécifique à la formation/prestation concernée
- Tient compte de l'historique des échanges pour adapter la formulation

Exemples de bons objets : "Votre devis – formations facilitation graphique", "Votre inscription en attente – SuperTilt", "Suite à notre échange – quelques précisions"

Réponds uniquement avec l'objet amélioré.`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      case "improve_email_body": {
        const systemPrompt = `Tu es un expert en rédaction d'emails commerciaux B2B pour SuperTilt, organisme de formation professionnelle certifié Qualiopi.
Tu réécris les emails pour qu'ils soient plus percutants, chaleureux et orientés action.
Ton style : phrases courtes et rythmées, direct mais bienveillant, focus sur la valeur pour le client, appel à l'action clair.
Tu utilises tout le contexte de l'opportunité (historique, profil client, échanges précédents) pour adapter le ton et le contenu.
Tu réponds UNIQUEMENT avec le contenu HTML amélioré, sans explication.`;

        const body = card_data.body || "";
        const subject = card_data.subject || "";

        const userPrompt = `Réécris ce corps d'email pour le rendre plus percutant et efficace commercialement.

${context}

Objet de l'email : "${subject}"

Email original (HTML) :
${body}

Objectifs de la réécriture :
- Utilise l'historique complet de l'opportunité ci-dessus pour personnaliser le message (références aux échanges précédents, à la situation du client, etc.)
- Adapte le ton au profil du client et à l'étape dans le pipeline
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

      case "cleanup_dictation": {
        const systemPrompt = `Tu es un assistant de mise en forme de texte dicté vocalement.
Tu corriges UNIQUEMENT :
- La ponctuation (points, virgules, points d'interrogation, etc.)
- L'orthographe et la grammaire
- Les retours à la ligne logiques entre les idées/paragraphes

RÈGLES STRICTES :
- Tu ne CHANGES JAMAIS les mots, les formulations ou les tournures de phrases
- Tu ne reformules RIEN
- Tu ne supprimes et n'ajoutes AUCUN mot
- Tu conserves le tutoiement ou vouvoiement tel quel
- Tu réponds UNIQUEMENT avec le texte corrigé en HTML (balises <p> pour les paragraphes, <br> pour les retours à la ligne simples)
- Pas d'explication, pas de commentaire`;

        const dictatedText = card_data.body || "";

        const userPrompt = `Mets en forme ce texte dicté vocalement. Corrige la ponctuation, l'orthographe et ajoute des retours à la ligne, mais ne change AUCUN mot ni aucune formulation :

${dictatedText}`;

        result = await callAnthropic(systemPrompt, userPrompt);
        break;
      }

      case "find_website": {
        const companyName = card_data.company?.trim();
        const emailDomain = card_data.context; // reuse context field for email domain
        if (!companyName && !emailDomain) {
          return createErrorResponse("company ou email requis", 400);
        }

        // 1) Try Clearbit autocomplete API (free, no key needed)
        const query = companyName || emailDomain || "";
        try {
          const clearbitRes = await fetch(
            `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`
          );
          if (clearbitRes.ok) {
            const suggestions = await clearbitRes.json();
            if (Array.isArray(suggestions) && suggestions.length > 0 && suggestions[0].domain) {
              result = `https://www.${suggestions[0].domain}`;
              break;
            }
          }
        } catch {
          // Clearbit unavailable, fall through to AI
        }

        // 2) Fallback: ask Claude to guess
        result = await callAnthropic(
          `Tu es un assistant qui trouve les sites web d'entreprises. Réponds UNIQUEMENT avec l'URL complète (https://...) ou le mot "unknown" si tu ne connais pas. Pas d'explication.`,
          `Quel est le site web officiel de l'entreprise "${query}" ?${emailDomain ? ` (domaine email : ${emailDomain})` : ""}`
        );
        result = result.trim();
        if (result.toLowerCase() === "unknown" || !result.startsWith("http")) {
          result = "";
        }
        break;
      }

      case "improve_template": {
        const systemPrompt = `Tu es un expert en rédaction de modèles d'emails commerciaux pour SuperTilt, organisme de formation professionnelle certifié Qualiopi.

On te fournit un modèle d'email (template) et la version réellement envoyée par l'utilisateur. Tu dois améliorer le modèle original en intégrant subtilement les améliorations que l'utilisateur a apportées lors de l'envoi.

Règles :
- Conserve les variables du modèle ({{first_name}}, {{last_name}}, {{company}}, {{title}}, etc.)
- Intègre le style, les formulations et la structure de la version envoyée
- Ne copie pas mot pour mot la version envoyée : le modèle doit rester générique et réutilisable
- Si l'utilisateur n'a fait que des changements mineurs ou spécifiques au contexte, conserve le modèle quasi identique
- Conserve le format HTML avec balises <p>
- Réponds UNIQUEMENT en JSON valide avec les clés "subject" et "html_content"`;

        const templateSubject = card_data.subject || "";
        const templateBody = card_data.body || "";
        const sentVersion = card_data.context || "";

        const userPrompt = `Voici le modèle d'email original :

Objet du modèle : "${templateSubject}"

Contenu du modèle (HTML) :
${templateBody}

Voici la version envoyée par l'utilisateur :
${sentVersion}

Améliore le modèle en t'inspirant des modifications de l'utilisateur. Réponds en JSON : {"subject": "...", "html_content": "..."}`;

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
