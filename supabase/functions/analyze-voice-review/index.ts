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
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de retours de relecture de contenu marketing.

On te donne la transcription vocale d'un retour de relecture. Tu dois séparer ce qui relève :
1. Du **problème** identifié (ce qui ne va pas, ce qui doit être changé)
2. De la **correction proposée** (la formulation ou le changement suggéré)

Utilise la function tool "split_review" pour structurer ta réponse.

Règles :
- Si le message ne contient qu'un problème sans correction explicite, laisse "correction" vide
- Reformule proprement (corrige les erreurs de transcription vocale évidentes)
- Garde le ton et l'intention de l'auteur
- Sois concis`;

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
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "split_review",
              description: "Sépare un retour de relecture en problème identifié et correction proposée",
              parameters: {
                type: "object",
                properties: {
                  problem: {
                    type: "string",
                    description: "Le problème identifié dans le contenu",
                  },
                  correction: {
                    type: "string",
                    description: "La correction ou reformulation proposée (vide si aucune correction explicite)",
                  },
                  comment_type: {
                    type: "string",
                    enum: ["fond", "forme"],
                    description: "Type de retour : 'fond' pour le contenu/sens, 'forme' pour la mise en forme/style/orthographe",
                  },
                },
                required: ["problem", "correction", "comment_type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "split_review" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback: return raw transcript as problem
      return new Response(JSON.stringify({ problem: transcript, correction: "", comment_type: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-voice-review error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
