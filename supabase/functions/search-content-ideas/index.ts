import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders, createErrorResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { z, parseBody } from "../_shared/validation.ts";

const requestSchema = z.object({
  query: z.string().min(1),
});

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const user = await verifyAuth(req.headers.get("authorization"));
  if (!user) return createErrorResponse("Unauthorized", 401, req);

  try {
    const { data, error } = await parseBody(req, requestSchema);
    if (error) return error;

    const { query } = data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch ideas cards from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch ALL cards from ALL columns (not just "Idées")
    const cardsRes = await fetch(
      `${supabaseUrl}/rest/v1/content_cards?select=id,title,description,tags,column_id,content_columns(name)`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const cards = await cardsRes.json();

    console.log(`[search-content-ideas] Found ${cards.length} cards to search through`);

    if (!cards.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Format cards for AI analysis - include column name for context
    const cardsText = cards.map((card: any, index: number) => 
      `[${index + 1}] Titre: ${card.title}
Description: ${card.description || "Pas de description"}
Tags: ${(card.tags || []).join(", ") || "Aucun tag"}
Colonne: ${card.content_columns?.name || "Non classé"}`
    ).join("\n\n");

    const systemPrompt = `Tu es un assistant marketing spécialisé dans la recherche de contenu pertinent.
Tu dois analyser une liste de contenus (titres, descriptions, tags) et identifier ceux qui correspondent le mieux à la recherche de l'utilisateur.

Analyse TOUS les champs : titre, description ET tags. Un mot-clé peut apparaître dans n'importe lequel de ces champs.

Pour chaque contenu pertinent, donne un score de pertinence entre 1 et 5 étoiles.
Réponds UNIQUEMENT au format JSON suivant, sans texte supplémentaire :
{
  "matches": [
    { "index": 1, "relevance": "★★★★★" },
    { "index": 3, "relevance": "★★★★" }
  ]
}

Si aucun contenu ne correspond vraiment à la recherche, réponds :
{ "matches": [] }`;

    const userPrompt = `RECHERCHE DE L'UTILISATEUR:
"${query}"

LISTE DES IDÉES:
${cardsText}

Identifie les idées les plus pertinentes par rapport à cette recherche.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || "{}";

    // Parse AI response
    let matches: { index: number; relevance: string }[] = [];
    try {
      const parsed = JSON.parse(aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
      matches = parsed.matches || [];
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
    }

    // Map matches back to cards
    const results = matches
      .filter((m) => m.index > 0 && m.index <= cards.length)
      .map((m) => ({
        card: {
          id: cards[m.index - 1].id,
          title: cards[m.index - 1].title,
          description: cards[m.index - 1].description,
          tags: cards[m.index - 1].tags || [],
          columnName: cards[m.index - 1].content_columns?.name || null,
        },
        relevance: m.relevance,
      }));

    console.log(`[search-content-ideas] Found ${results.length} matching results for query: "${query}"`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-content-ideas:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
