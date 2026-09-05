import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { aiChat } from "../_shared/ai.ts";
import { parseAiJson, truncateForLog, STRICT_JSON_INSTRUCTION } from "../_shared/ai-json.ts";


serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

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

    const askAi = (extra?: string) =>
      aiChat({
        system: extra ? `${systemPrompt}\n\n${extra}` : systemPrompt,
        messages: [{ role: "user", content: `Notes de session :\n\n${notes}` }],
        tier: "fast",
        temperature: 0.3,
        origin: "summarize-coaching",
        operation: "summary",
        trigger: "user",
      });

    const content = await askAi();
    let parsed = parseAiJson<Record<string, unknown>>(content);

    if (!parsed) {
      console.error("[summarize-coaching] unparseable AI response:", truncateForLog(content));
      const retryContent = await askAi(STRICT_JSON_INSTRUCTION);
      parsed = parseAiJson<Record<string, unknown>>(retryContent);
      if (!parsed) {
        console.error("[summarize-coaching] retry also unparseable:", truncateForLog(retryContent));
        return new Response(
          JSON.stringify({
            error: "L'IA n'a pas réussi à structurer le résumé. Réessayez dans un instant.",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }


    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
