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

    const { context } = await req.json();
    if (!context || typeof context !== "string") {
      return createErrorResponse("Le champ 'context' est requis", 400);
    }

    const systemPrompt = `Tu es un assistant commercial expert pour un consultant-formateur indépendant spécialisé en formation professionnelle et conseil.

Tu reçois toutes les informations disponibles sur une opportunité commerciale : description complète, historique des échanges email, notes internes et commentaires.

Ton rôle est de produire une synthèse structurée et exploitable qui servira de base à la rédaction d'un devis professionnel.

RÈGLES IMPÉRATIVES :
- Analyse TOUS les emails en profondeur : extrais les besoins explicites ET implicites, les contraintes mentionnées, les dates, les budgets, le nombre de participants, les modalités souhaitées
- Croise les informations entre emails, description et commentaires pour avoir une vue complète
- Identifie les points non clarifiés ou les contradictions éventuelles
- Sois factuel et précis, cite les informations clés avec leur source quand pertinent
- Rédige en français professionnel
- ÉCRIS DE MANIÈRE DENSE ET CONCISE : pas de sauts de ligne inutiles, pas de lignes vides entre les puces, texte compact

FORMAT DE SORTIE — EXCLUSIVEMENT en HTML simple (PAS de markdown, PAS de \`\`\`, PAS de balises code) :

<h3>Contexte client</h3>
<p>Qui est le client, son secteur, sa taille si connue</p>

<h3>Besoins identifiés</h3>
<ul><li>Besoin 1</li><li>Besoin 2</li></ul>

<h3>Périmètre de la prestation</h3>
<p>Type de prestation, durée, modalités, nombre de participants, dates envisagées</p>

<h3>Contraintes et spécificités</h3>
<ul><li>Budget, planning, prérequis, public cible</li></ul>

<h3>Points d'attention</h3>
<ul><li>Éléments à clarifier, risques, points non validés</li></ul>

<h3>Éléments de valorisation</h3>
<ul><li>Arguments commerciaux, leviers de valeur</li></ul>

IMPORTANT : Retourne UNIQUEMENT le HTML, sans aucun wrapper markdown, sans \`\`\`html, sans commentaires.`;

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
          { role: "user", content: `Voici toutes les informations disponibles sur l'opportunité :\n\n${context}` },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    let raw = (result.choices?.[0]?.message?.content || "").trim();

    // Strip markdown code fences if present
    raw = raw.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    // If the output looks like markdown (contains ## or **), convert to HTML
    if (/^#{1,3}\s/m.test(raw) || /\*\*/.test(raw)) {
      raw = raw
        // Headings
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^## (.+)$/gm, "<h3>$1</h3>")
        .replace(/^# (.+)$/gm, "<h2>$1</h2>")
        // Bold / italic
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // List items: group consecutive lines starting with "- "
        .replace(/(^- .+$(\n|$))+/gm, (block) => {
          const items = block.trim().split("\n").map(l => `<li>${l.replace(/^- /, "")}</li>`).join("");
          return `<ul>${items}</ul>`;
        })
        // Paragraphs: wrap remaining non-tag lines
        .replace(/^(?!<[hup\/]|<li|<ul|<ol)(.+)$/gm, "<p>$1</p>")
        // Clean up empty lines
        .replace(/\n{2,}/g, "\n")
        .trim();
    }

    return createJsonResponse({ synthesis: raw });
  } catch (error: unknown) {
    console.error("Error in generate-quote-synthesis:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
