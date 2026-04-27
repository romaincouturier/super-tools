import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { CLAUDE_DEFAULT } from "../_shared/claude-models.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Tu es un coach de productivité pour un dirigeant d'organisme de formation professionnelle.

On te donne la liste des actions du jour (TODO quotidienne). Chaque action a une catégorie, un titre et une description.

Ta mission : proposer un agenda pour la journée en regroupant et priorisant les actions.

Règles de priorisation :
1. **Urgences financières d'abord** : factures à émettre, missions à facturer, activités non facturées — c'est le cash-flow
2. **Actions avec deadline ou en retard** : les descriptions mentionnant "En retard", une date passée, ou un nombre de jours
3. **Actions commerciales** : devis à faire, devis à relancer, opportunités — génèrent le chiffre d'affaires futur
4. **Actions opérationnelles** : missions, conventions, réservations — maintiennent l'activité
5. **Contenu et relecture** : articles, commentaires — important mais moins urgent
6. **Veille et suivi** : CFP à surveiller, OKR, événements — peut attendre
7. **Les actions déjà complétées ne doivent PAS apparaître dans l'agenda**

Format de réponse en markdown :
- Commence par une phrase d'accroche motivante et personnalisée (1 ligne max)
- Propose 2 à 4 blocs horaires (matin tôt, fin de matinée, début d'après-midi, fin de journée)
- Pour chaque bloc : un titre, les actions à traiter (reprends les titres exacts), et une justification courte de la priorité
- Termine par un conseil de productivité adapté à la charge du jour
- Sois concis, pas de blabla. Maximum 300 mots.
- Réponds en français.`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { actions } = await req.json();

    if (!actions || actions.length === 0) {
      return new Response(
        JSON.stringify({ agenda: "Aucune action pour aujourd'hui. Profitez-en pour prendre de l'avance !" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const now = new Date();
    const dayName = now.toLocaleDateString("fr-FR", { weekday: "long" });
    const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const actionsSummary = actions.map((a: any, i: number) =>
      `${i + 1}. [${a.category}] ${a.title}${a.description ? ` — ${a.description}` : ""}`
    ).join("\n");

    const userPrompt = `Aujourd'hui : ${dayName} ${dateStr}
Nombre d'actions : ${actions.length}

Actions du jour :
${actionsSummary}

Propose-moi un agenda priorisé pour traiter ces actions.`;

    let agenda: string;

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
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });
      const lovableData = await lovableResponse.json();
      agenda = lovableData.choices?.[0]?.message?.content || "Impossible de générer l'agenda.";
    } else {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_DEFAULT,
          max_tokens: 1500,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      const data = await response.json();
      agenda = data.content?.[0]?.text || "Impossible de générer l'agenda.";
    }

    return new Response(
      JSON.stringify({ agenda }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Generate Daily Agenda error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
