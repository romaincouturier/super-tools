import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import Anthropic from "npm:@anthropic-ai/sdk@^0.74.0";
import OpenAI from "npm:openai@^4.77.0";

// Inline expert catalog for the Edge Function (avoids sharing code with frontend)
const EXPERT_IDS = [
  "cto", "architecte-senior", "dev-senior", "sre", "security-engineer", "data-engineer",
  "ceo", "cfo", "cmo", "product-manager", "strategy-consultant", "sales-director",
  "ux-designer", "brand-strategist", "content-strategist",
  "drh", "change-manager", "coach-agile", "psychologue-travail",
  "juriste", "ethicien-ia",
  "data-scientist", "growth-hacker",
  "philosophe", "sociologue", "economiste",
  "devrel", "coach-bien-etre", "pair-aidant", "facilitateur",
];

const EXPERT_CATALOG = [
  "cto | CTO (Chief Technology Officer) | tech | architecture, scalabilite, management tech | architecture, strategie-tech, cloud",
  "architecte-senior | Architecte Senior (Architecte Logiciel) | tech | design patterns, DDD, migration legacy | architecture, design-patterns, api",
  "dev-senior | Dev Senior (Full-Stack Senior) | tech | code, testing, CI/CD, mentoring | code, testing, performance",
  "sre | SRE (Site Reliability Engineer) | tech | observabilite, SLO, incidents, kubernetes | fiabilite, monitoring, infrastructure",
  "security-engineer | Security Engineer | tech | OWASP, threat modeling, RGPD | securite, rgpd, compliance",
  "data-engineer | Data Engineer | tech | pipelines, data lakes, data quality | data, pipeline, streaming",
  "ceo | CEO | business | vision strategique, business model, go-to-market | strategie, croissance, startup",
  "cfo | CFO | business | P&L, unit economics, pricing, ROI | finance, budget, pricing",
  "cmo | CMO | business | brand, acquisition, retention, growth | marketing, acquisition, growth",
  "product-manager | Product Manager | business | discovery, priorisation, user research | produit, utilisateurs, roadmap",
  "strategy-consultant | Consultant Strategie | business | due diligence, transformation digitale | strategie, analyse, concurrence",
  "sales-director | Directeur Commercial | business | vente B2B, negotiation, pipeline | vente, clients, revenus",
  "ux-designer | Designer UX | creative | user research, wireframing, accessibilite | design, ux, interface",
  "brand-strategist | Strategiste Marque | creative | identite, positionnement, storytelling | marque, branding, communication",
  "content-strategist | Content Strategist | creative | SEO, editorial, copywriting | contenu, seo, redaction",
  "drh | DRH | human | recrutement, culture, formation | rh, recrutement, management",
  "change-manager | Change Manager | human | transformation, adoption, resistance | changement, transformation, communication",
  "coach-agile | Coach Agile | human | scrum, kanban, facilitation | agile, equipe, organisation",
  "psychologue-travail | Psychologue du Travail | human | RPS, burn-out, dynamique groupe | bien-etre, stress, conflit",
  "juriste | Juriste | legal | contrats, PI, RGPD, compliance | juridique, contrats, rgpd",
  "ethicien-ia | Ethicien IA | legal | biais, equite, transparence IA | ethique, ia, biais",
  "data-scientist | Data Scientist | data | ML, statistiques, NLP, LLMs | ia, ml, data",
  "growth-hacker | Growth Hacker | data | AARRR, experimentation, PLG | growth, acquisition, conversion",
  "philosophe | Philosophe | academic | epistemologie, ethique, pensee critique | ethique, pensee-critique, debat",
  "sociologue | Sociologue | academic | sociologie du travail, dynamiques pouvoir | societe, organisation, pouvoir",
  "economiste | Economiste | academic | economie comportementale, nudge | economie, incitations, comportement",
  "devrel | DevRel | tech | developer experience, documentation, community | developpeur, api, documentation",
  "coach-bien-etre | Coach Bien-etre | human | stress, resilience, mindfulness | bien-etre, resilience, equilibre",
  "pair-aidant | Pair Aidant | human | soutien pairs, retablissement | soutien, ecoute, empathie",
  "facilitateur | Facilitateur | human | facilitation, co-creation, decision collective | facilitation, intelligence-collective, atelier",
];

interface RequestBody {
  apiKey: string;
  provider?: "claude" | "openai" | "gemini";
  topic: string;
  mode: "exploration" | "decision" | "deliverable";
  language: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse("Invalid JSON", 400);
  }

  const { apiKey: clientApiKey, provider = "claude", topic, mode, language } = body;

  // For Claude, use server-side ANTHROPIC_API_KEY secret
  const apiKey = provider === "claude"
    ? (Deno.env.get("ANTHROPIC_API_KEY") || clientApiKey)
    : clientApiKey;

  if (!apiKey || !topic) {
    return createErrorResponse("Missing apiKey or topic", 400);
  }

  const expertCatalog = EXPERT_CATALOG.map((line) => `- id:${line}`).join("\n");

  const modeDesc: Record<string, string> = {
    exploration: "discussion ouverte et exploratoire (brainstorm, decouverte)",
    decision: "debat contradictoire pour prendre une decision (vote final)",
    deliverable: "production collaborative d'un livrable concret (document, spec, plan)",
  };

  const prompt = `Tu es un expert en composition d'equipes de discussion. Ton role : choisir les 3 a 4 experts les plus pertinents pour discuter de ce sujet.

SUJET : ${topic}
MODE : ${modeDesc[mode]}
LANGUE : ${language === "fr" ? "francais" : "anglais"}

CATALOGUE D'EXPERTS DISPONIBLES :
${expertCatalog}

REGLES :
1. Choisis 3 a 4 experts (pas plus) qui apportent des perspectives COMPLEMENTAIRES et non redondantes
2. En mode decision, inclus au moins un expert qui sera naturellement "pour" et un "contre"
3. En mode deliverable, inclus les competences necessaires pour produire le livrable
4. Explique en 1 phrase pourquoi chaque expert est pertinent pour CE sujet
5. Suggere aussi le mode de discussion optimal si different de celui demande

Tu DOIS repondre UNIQUEMENT avec un JSON valide :
{
  "experts": [
    { "id": "expert_id", "reason": "pourquoi cet expert est pertinent", "suggestedStance": "pour|contre|neutre" }
  ],
  "suggestedMode": "exploration|decision|deliverable",
  "modeReason": "pourquoi ce mode (optionnel, seulement si different du mode demande)"
}`;

  try {
    let text = "";

    if (provider === "openai") {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      text = response.choices[0]?.message?.content || "";
    } else if (provider === "gemini") {
      const client = new OpenAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
      const response = await client.chat.completions.create({
        model: "gemini-2.0-flash",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      text = response.choices[0]?.message?.content || "";
    } else {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      text = response.content[0].type === "text" ? response.content[0].text : "";
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = {
          experts: EXPERT_IDS.slice(0, 3).map((id) => ({
            id,
            reason: "Suggestion par defaut",
            suggestedStance: "neutre",
          })),
          suggestedMode: mode,
        };
      }
    }

    // Validate expert IDs exist
    const validIds = new Set(EXPERT_IDS);
    parsed.experts = (parsed.experts || []).filter(
      (e: { id: string }) => validIds.has(e.id)
    );

    if (parsed.experts.length === 0) {
      parsed.experts = EXPERT_IDS.slice(0, 3).map((id) => ({
        id,
        reason: "Suggestion par defaut",
        suggestedStance: "neutre",
      }));
    }

    return createJsonResponse(parsed);
  } catch (err) {
    return createJsonResponse({
      error: err instanceof Error ? err.message : "Suggest error",
      experts: EXPERT_IDS.slice(0, 3).map((id) => ({
        id,
        reason: "Suggestion par defaut (erreur API)",
        suggestedStance: "neutre",
      })),
      suggestedMode: mode,
    });
  }
});
