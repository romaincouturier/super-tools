import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  escapeHtml,
} from "../_shared/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  priority: number;
}

// Search knowledge base using full-text search and keywords
async function searchKnowledgeBase(
  supabase: ReturnType<typeof getSupabaseClient>,
  question: string
): Promise<KnowledgeEntry[]> {
  // Extract keywords from question (simple tokenization)
  const keywords = question
    .toLowerCase()
    .replace(/[?!.,;:]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2);

  if (keywords.length === 0) {
    // If no valid keywords, return top priority entries
    const { data } = await supabase
      .from("chatbot_knowledge_base")
      .select("id, category, title, content, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(5);
    return data || [];
  }

  // Use raw SQL for full-text search on combined columns
  const searchQuery = keywords.join(" | ");
  const { data: fullTextResults } = await supabase
    .from("chatbot_knowledge_base")
    .select("id, category, title, content, priority")
    .eq("is_active", true)
    .or(`title.ilike.%${keywords[0]}%,content.ilike.%${keywords[0]}%`)
    .order("priority", { ascending: false })
    .limit(10);

  // Also search by keywords array overlap
  const { data: keywordResults } = await supabase
    .from("chatbot_knowledge_base")
    .select("id, category, title, content, priority")
    .eq("is_active", true)
    .overlaps("keywords", keywords)
    .order("priority", { ascending: false })
    .limit(10);

  // Merge and deduplicate results
  const allResults = [...(fullTextResults || []), ...(keywordResults || [])];
  const uniqueResults = Array.from(
    new Map(allResults.map(item => [item.id, item])).values()
  );

  // Sort by priority and return top results
  return uniqueResults
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

// Generate response using Claude
async function generateResponse(
  question: string,
  context: KnowledgeEntry[]
): Promise<{ answer: string; sources: string[] }> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Build context from knowledge base entries
  const contextText = context
    .map((entry, i) => `[${i + 1}] ${entry.category} - ${entry.title}\n${entry.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `Tu es un assistant virtuel pour Supertilt, un organisme de formation professionnelle certifié Qualiopi.
Tu aides les utilisateurs à comprendre le fonctionnement du logiciel de gestion des formations et les règles métier.

RÈGLES IMPORTANTES:
- Réponds UNIQUEMENT en te basant sur le contexte fourni ci-dessous
- Si l'information n'est pas dans le contexte, dis-le clairement et suggère de contacter le support
- Sois concis et précis dans tes réponses
- Utilise un ton professionnel mais amical
- Si tu cites une source, indique son numéro entre crochets [1], [2], etc.
- Réponds en français

CONTEXTE DE LA BASE DE CONNAISSANCES:
${contextText || "Aucune information pertinente trouvée dans la base de connaissances."}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", errorText);
    throw new Error(`Failed to generate response: ${response.status}`);
  }

  const result = await response.json();
  const answer = result.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer une réponse.";

  return {
    answer,
    sources: context.map(e => e.id),
  };
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { question, conversationId } = await req.json();

    if (!question || typeof question !== "string") {
      return createErrorResponse("question is required", 400);
    }

    if (question.length > 1000) {
      return createErrorResponse("Question too long (max 1000 characters)", 400);
    }

    const supabase = getSupabaseClient();

    // Get user from auth header if available
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    console.log("Processing chatbot question:", question.substring(0, 100));

    // Search knowledge base
    const relevantEntries = await searchKnowledgeBase(supabase, question);
    console.log(`Found ${relevantEntries.length} relevant knowledge base entries`);

    // Generate response
    const { answer, sources } = await generateResponse(question, relevantEntries);

    // Save conversation for analytics
    try {
      await supabase.from("chatbot_conversations").insert({
        user_id: userId,
        question: question,
        answer: answer,
        sources: sources,
      });
    } catch (saveError) {
      console.warn("Failed to save conversation:", saveError);
    }

    return createJsonResponse({
      answer,
      sources: relevantEntries.map(e => ({
        id: e.id,
        category: e.category,
        title: e.title,
      })),
    });
  } catch (error: unknown) {
    console.error("Error processing chatbot query:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process query";
    return createErrorResponse(errorMessage);
  }
});
