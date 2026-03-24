import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

const LOVABLE_AI_URL = "https://api.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { question, context_type } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question requise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from multiple sources
    const supabase = getSupabaseClient();

    // Gather knowledge from chatbot_knowledge_base
    const { data: knowledge } = await supabase
      .from("chatbot_knowledge_base")
      .select("title, content, category")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20);

    // Gather recent training data for context
    const { data: trainings } = await supabase
      .from("trainings")
      .select("nom_formation, format_formation, objectives, prerequisites")
      .order("created_at", { ascending: false })
      .limit(10);

    // Gather formation configs (catalogue)
    const { data: catalogue } = await supabase
      .from("formation_configs")
      .select("formation_name, description, objectives, prerequisites, duree_heures, prix")
      .eq("is_active", true)
      .limit(20);

    // Gather recent improvements for quality context
    const { data: improvements } = await supabase
      .from("improvements")
      .select("title, description, status, category")
      .order("created_at", { ascending: false })
      .limit(10);

    // Build RAG context
    const contextParts: string[] = [];

    if (knowledge?.length) {
      contextParts.push("## Base de connaissances\n" +
        knowledge.map((k) => `### ${k.title} (${k.category})\n${k.content}`).join("\n\n")
      );
    }

    if (catalogue?.length) {
      contextParts.push("## Catalogue de formations\n" +
        catalogue.map((c) =>
          `- **${c.formation_name}**: ${c.description || ""} | ${c.duree_heures}h | ${c.prix}€` +
          (c.objectives?.length ? ` | Objectifs: ${c.objectives.join(", ")}` : "")
        ).join("\n")
      );
    }

    if (trainings?.length) {
      contextParts.push("## Formations récentes\n" +
        trainings.map((t) => `- ${t.nom_formation} (${t.format_formation || ""})`).join("\n")
      );
    }

    if (improvements?.length) {
      contextParts.push("## Améliorations en cours\n" +
        improvements.map((i) => `- [${i.status}] ${i.title}: ${i.description}`).join("\n")
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
      sources: contextParts.length > 0 ? ["knowledge_base", "catalogue", "trainings", "improvements"] : [],
    });

    return new Response(JSON.stringify({ answer, sources_used: contextParts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
