import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { question } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question requise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from multiple sources
    const supabase = getSupabaseClient();

    // Security: require authentication and block learners.
    // This chatbot exposes Super Tools platform data — learners must never access it.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser } } = await supabase.auth.getUser(token);
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (callerUser.user_metadata?.role === "learner") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather knowledge from chatbot_knowledge_base only.
    // trainings, formation_configs, and improvements are intentionally excluded:
    // they contain client business data that must never be exposed via this endpoint.
    const { data: knowledge } = await supabase
      .from("chatbot_knowledge_base")
      .select("title, content, category")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20);

    // Build RAG context
    const contextParts: string[] = [];

    if (knowledge?.length) {
      contextParts.push("## Base de connaissances\n" +
        knowledge.map((k) => `### ${k.title} (${k.category})\n${k.content}`).join("\n\n")
      );
    }

    const ragContext = contextParts.join("\n\n---\n\n");

    const systemPrompt = `Tu es l'assistant IA de SuperTools, une plateforme de gestion de formations.
Tu aides les formateurs à répondre à leurs questions sur leur activité, leurs formations, et les bonnes pratiques.

Voici le contexte de leur activité :

${ragContext}

Règles :
- Réponds en français, de manière concise et professionnelle
- Base tes réponses sur le contexte fourni quand c'est pertinent
- Si tu ne trouves pas l'info dans le contexte, dis-le clairement
- Pour les questions Qualiopi, sois précis sur les indicateurs concernés
- Propose des actions concrètes quand c'est pertinent`;

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
          { role: "user", content: question },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await response.json();
    const answer = aiData.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    // Log conversation
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    await supabase.from("chatbot_conversations").insert({
      question,
      answer,
      user_id: userId,
      sources: contextParts.length > 0 ? ["knowledge_base"] : [],
    });

    return new Response(JSON.stringify({ answer, sources_used: contextParts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    await reportEdgeError(error, { fn: "rag-chatbot" });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
