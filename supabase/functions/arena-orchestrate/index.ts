import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.74.0";
import OpenAI from "https://esm.sh/openai@4.77.0";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { logAnthropicUsage } from "../_shared/api-usage.ts";
import { isArenaHistoryAppendOnly, joinedParts, textBlocks } from "../_shared/prompt-cache.ts";

interface RequestBody {
  provider: "claude" | "openai" | "gemini";
  apiKey: string;
  model: string;
  systemPrompt: string;
  turnInstruction: string;
  history: { agentName: string; content: string; isUser?: boolean }[];
  topic: string;
  maxTokens: number;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const _authUser = await verifyAuth(req.headers.get("Authorization"));
  if (!_authUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const { provider = "claude", apiKey: clientApiKey, model, systemPrompt, turnInstruction, history, topic, maxTokens } = body;

  // For Claude, use server-side ANTHROPIC_API_KEY secret
  const apiKey = provider === "claude"
    ? (Deno.env.get("ANTHROPIC_API_KEY") || clientApiKey)
    : clientApiKey;

  if (!apiKey || !model || !systemPrompt) {
    return new Response("Missing required fields (apiKey, model, systemPrompt)", { status: 400, headers: corsHeaders });
  }

  // Build user message from history
  //
  // L'historique est renvoyé en entier à chaque prise de parole. Chaque expert
  // a son propre system prompt, donc le cache ne se partage pas entre experts :
  // il sert au même expert d'un tour à l'autre. Pour cela l'historique est
  // découpé en un bloc par message (un bloc unique change à chaque tour et
  // n'est jamais relu) et séparé de l'instruction du tour, qui reste après le
  // point de cache.
  let historyParts: string[] = [];
  let turnText: string;
  if (history && history.length > 0) {
    historyParts = joinedParts(
      "Voici l'historique de la discussion jusqu'ici :\n\n",
      history.map((m) => `[${m.isUser ? "Utilisateur" : m.agentName}]: ${m.content}`),
      "\n\n",
    );
    turnText = `\n\n---\n\nInstruction pour ce tour : ${turnInstruction}`;
  } else {
    turnText = `Sujet de discussion : ${topic}\n\nInstruction : ${turnInstruction}`;
  }
  const userContent = historyParts.join("") + turnText;
  const cacheHistory = historyParts.length > 0 && isArenaHistoryAppendOnly(history);

  try {
    if (provider === "openai") {
      return await streamOpenAI(apiKey, model, systemPrompt, userContent, maxTokens);
    } else if (provider === "gemini") {
      return await streamGemini(apiKey, model, systemPrompt, userContent, maxTokens);
    } else {
      return await streamClaude(apiKey, model, systemPrompt, historyParts, cacheHistory, turnText, maxTokens);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function sseHeaders() {
  return {
    ...corsHeaders,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function sseEncode(encoder: TextEncoder, data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

// ─── Claude (Anthropic) ───
async function streamClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  historyParts: string[],
  cacheHistory: boolean,
  turnText: string,
  maxTokens: number,
) {
  // Point de cache sur le dernier message de l'historique : l'instruction du
  // tour reste après. Pas de breakpoint sans historique (premier tour) ni
  // quand la fenêtre glissante a résumé le début : une écriture jamais relue
  // est facturée 1,25x pour rien.
  const content = [...textBlocks(historyParts, cacheHistory), ...textBlocks([turnText], false)];

  const client = new Anthropic({ apiKey });
  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens || 1200,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if ("text" in delta) {
              controller.enqueue(sseEncode(encoder, JSON.stringify({ type: "content", text: delta.text })));
            }
          }
        }
        const final = await stream.finalMessage();
        await logAnthropicUsage({
          origin: "arena-orchestrate",
          operation: "stream",
          model: final.model,
          trigger: "user",
          usage: final.usage,
        });
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "usage",
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        })));
        controller.enqueue(sseEncode(encoder, "[DONE]"));
        controller.close();
      } catch (err) {
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "error", message: err instanceof Error ? err.message : "Claude error",
        })));
        controller.close();
      }
    },
  });
  return new Response(readableStream, { headers: sseHeaders() });
}

// ─── OpenAI ───
async function streamOpenAI(
  apiKey: string, model: string, systemPrompt: string, userContent: string, maxTokens: number
) {
  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens || 1200,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        let inputTokens = 0;
        let outputTokens = 0;
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            controller.enqueue(sseEncode(encoder, JSON.stringify({ type: "content", text: delta.content })));
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens || 0;
            outputTokens = chunk.usage.completion_tokens || 0;
          }
        }
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "usage", inputTokens, outputTokens,
        })));
        controller.enqueue(sseEncode(encoder, "[DONE]"));
        controller.close();
      } catch (err) {
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "error", message: err instanceof Error ? err.message : "OpenAI error",
        })));
        controller.close();
      }
    },
  });
  return new Response(readableStream, { headers: sseHeaders() });
}

// ─── Gemini (via OpenAI-compatible endpoint) ───
async function streamGemini(
  apiKey: string, model: string, systemPrompt: string, userContent: string, maxTokens: number
) {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens || 1200,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const encoder = new TextEncoder();
  let totalChars = 0;
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            totalChars += delta.content.length;
            controller.enqueue(sseEncode(encoder, JSON.stringify({ type: "content", text: delta.content })));
          }
        }
        const estimatedOutputTokens = Math.ceil(totalChars / 4);
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "usage",
          inputTokens: 0,
          outputTokens: estimatedOutputTokens,
        })));
        controller.enqueue(sseEncode(encoder, "[DONE]"));
        controller.close();
      } catch (err) {
        controller.enqueue(sseEncode(encoder, JSON.stringify({
          type: "error", message: err instanceof Error ? err.message : "Gemini error",
        })));
        controller.close();
      }
    },
  });
  return new Response(readableStream, { headers: sseHeaders() });
}
