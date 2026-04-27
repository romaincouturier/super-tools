import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { CLAUDE_DEFAULT } from "../_shared/claude-models.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const ONBOARDING_SYSTEM = `Tu es un coach en positionnement professionnel pour formateurs indépendants.
Tu guides l'utilisateur à travers 3 blocs de questions pour construire sa fiche de positionnement :

**Bloc 1 — Identité** : Qui es-tu ? Quel est ton parcours ? Quelles sont tes expertises ?
**Bloc 2 — Valeur** : Quelle transformation apportes-tu ? Qu'est-ce qui te différencie ?
**Bloc 3 — Cible** : À qui t'adresses-tu ? Quel est ton client idéal ?

Règles :
- Pose les questions une par une, de façon conversationnelle et bienveillante
- Reformule ce que l'utilisateur dit pour montrer que tu comprends
- Ne passe au bloc suivant que quand le bloc en cours est suffisamment couvert
- Quand les 3 blocs sont couverts, propose une synthèse sous forme de fiche de positionnement
- Réponds toujours en français
- Sois concis (2-4 phrases par message)

Quand tu as suffisamment d'information pour les 3 blocs, termine ton message par un bloc JSON sur une ligne séparée, formaté exactement comme ceci :
:::POSITIONING:::{"pitch_one_liner":"...", "key_skills":["...","..."], "target_client":"..."}:::END:::`;

const CARTOGRAPHY_SYSTEM = `Tu es un coach en développement de réseau professionnel pour formateurs indépendants.
Tu guides l'utilisateur à cartographier son réseau existant en posant des questions séquencées :

1. Anciens collègues ou managers qui connaissent ton travail
2. Clients ou participants satisfaits de tes formations
3. Partenaires potentiels (autres formateurs, consultants)
4. Contacts dans des organismes de formation ou RH
5. Personnes rencontrées en événements professionnels
6. Contacts LinkedIn actifs dans ton domaine
7. Amis ou famille connectés à ton marché cible

Règles :
- Pose une catégorie à la fois
- Pour chaque contact mentionné, demande le contexte et évalue la chaleur (hot/warm/cold)
- hot = contact récent et relation forte, warm = connu mais pas contacté récemment, cold = lointain
- Reformule et encourage
- Réponds en français, sois concis

Quand l'utilisateur mentionne des contacts, extrais-les dans un bloc JSON sur une ligne séparée :
:::CONTACTS:::[{"name":"...","context":"...","warmth":"warm"}]:::END:::
Tu peux continuer la conversation après avoir extrait des contacts.`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { messages, phase, positioning, contacts } = await req.json();

    if (!messages || !phase) {
      return new Response(JSON.stringify({ error: "messages et phase requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    let systemPrompt = phase === "onboarding" ? ONBOARDING_SYSTEM : CARTOGRAPHY_SYSTEM;

    if (phase === "onboarding" && positioning) {
      systemPrompt += `\n\nFiche de positionnement actuelle de l'utilisateur :\n${JSON.stringify(positioning)}`;
    }

    if (phase === "cartography" && contacts && contacts.length > 0) {
      systemPrompt += `\n\nContacts déjà cartographiés :\n${JSON.stringify(contacts)}`;
    }

    const apiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    let answer: string;

    if (!anthropicKey) {
      const lovableResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...apiMessages,
          ],
          max_tokens: 2000,
          temperature: 0.4,
        }),
      });
      const lovableData = await lovableResponse.json();
      answer = lovableData.choices?.[0]?.message?.content || "Pas de réponse";
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
          max_tokens: 2000,
          temperature: 0.4,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
      const data = await response.json();
      answer = data.content?.[0]?.text || "Pas de réponse";
    }

    // Extract structured data from response
    const result: { reply: string; positioning?: unknown; contacts?: unknown } = { reply: answer };

    const posMatch = answer.match(/:::POSITIONING:::(.*?):::END:::/s);
    if (posMatch) {
      try {
        result.positioning = JSON.parse(posMatch[1]);
        result.reply = answer.replace(/:::POSITIONING:::.*?:::END:::/s, "").trim();
      } catch { /* ignore parse errors */ }
    }

    const contactsMatch = answer.match(/:::CONTACTS:::(.*?):::END:::/s);
    if (contactsMatch) {
      try {
        result.contacts = JSON.parse(contactsMatch[1]);
        result.reply = answer.replace(/:::CONTACTS:::.*?:::END:::/s, "").trim();
      } catch { /* ignore parse errors */ }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Network AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
