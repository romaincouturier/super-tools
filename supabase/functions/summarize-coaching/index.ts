import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_AI_URL = "https://api.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes, participant_name, training_name } = await req.json();

    if (!notes) {
      return new Response(JSON.stringify({ error: "Notes requises" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un assistant spécialisé dans le résumé de sessions de coaching professionnel.
À partir des notes de session fournies, génère un résumé structuré en JSON avec :
- "summary": Un paragraphe de synthèse de la session (3-5 phrases)
- "key_topics": Un tableau des sujets clés abordés (strings)
- "action_items": Un tableau d'actions à mener (objets {action, deadline_suggestion, priority})
- "mood": L'état d'esprit/dynamique perçu(e) du participant (1 phrase)

Contexte : Session de coaching pour ${participant_name || "un participant"} dans le cadre de la formation "${training_name || "non précisée"}".

Réponds UNIQUEMENT en JSON valide, sans markdown.`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Notes de session :\n\n${notes}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans quelques secondes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      parsed = match ? JSON.parse(match[1]) : { summary: content, key_topics: [], action_items: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
