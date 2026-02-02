import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ideas cards from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // First get the "Idées" column
    const columnsRes = await fetch(
      `${supabaseUrl}/rest/v1/content_columns?name=eq.Id%C3%A9es&select=id`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const columns = await columnsRes.json();
    if (!columns.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ideasColumnId = columns[0].id;

    // Fetch cards from ideas column
    const cardsRes = await fetch(
      `${supabaseUrl}/rest/v1/content_cards?column_id=eq.${ideasColumnId}&select=id,title,description,tags`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const cards = await cardsRes.json();

    if (!cards.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format cards for AI analysis
    const cardsText = cards.map((card: any, index: number) => 
      `[${index + 1}] Titre: ${card.title}
Description: ${card.description || "Pas de description"}
Tags: ${(card.tags || []).join(", ") || "Aucun tag"}`
    ).join("\n\n");

    const systemPrompt = `Tu es un assistant marketing spécialisé dans la recherche de contenu pertinent.
Tu dois analyser une liste d'idées de contenu et identifier celles qui correspondent le mieux à la recherche de l'utilisateur.

Pour chaque idée pertinente, donne un score de pertinence entre 1 et 5 étoiles.
Réponds UNIQUEMENT au format JSON suivant, sans texte supplémentaire :
{
  "matches": [
    { "index": 1, "relevance": "★★★★★" },
    { "index": 3, "relevance": "★★★★" }
  ]
}

Si aucune idée ne correspond, réponds :
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "{}";

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
        },
        relevance: m.relevance,
      }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-content-ideas:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
