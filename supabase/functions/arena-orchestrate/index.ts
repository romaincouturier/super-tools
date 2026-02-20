import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.74.0";
import OpenAI from "https://esm.sh/openai@4.77.0";
import { z, parseBody } from "../_shared/validation.ts";

const historyItemSchema = z.object({
  agentName: z.string(),
  content: z.string(),
  isUser: z.boolean().optional(),
});

const requestSchema = z.object({
  provider: z.enum(["claude", "openai", "gemini"]).optional().default("claude"),
  apiKey: z.string().optional().default(""),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  turnInstruction: z.string().min(1),
  history: z.array(historyItemSchema).optional().default([]),
  topic: z.string().min(1),
  maxTokens: z.number().optional().default(1200),
});

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const { data, error } = await parseBody(req, requestSchema);
  if (error) return error;

  const { provider, apiKey: clientApiKey, model, systemPrompt, turnInstruction, history, topic, maxTokens } = data;

  // For Claude, use server-side ANTHROPIC_API_KEY secret
  const apiKey = provider === "claude"
    ? (Deno.env.get("ANTHROPIC_API_KEY") || clientApiKey)
    : clientApiKey;

  if (!apiKey || !model || !systemPrompt) {
    return new Response("Missing required fields (apiKey, model, systemPrompt)", { status: 400, headers: corsHeaders });
  }

  // Build user message from history
  let userContent: string;
  if (history && history.length > 0) {
    const historyText = history
      .map((m) => `[${m.isUser ? "Utilisateur" : m.agentName}]: ${m.content}`)
      .join("\n\n");
    userContent = `Voici l'historique de la discussion jusqu'ici :\n\n${historyText}\n\n---\n\nInstruction pour ce tour : ${turnInstruction}`;
  } else {
    userContent = `Sujet de discussion : ${topic}\n\nInstruction : ${turnInstruction}`;
  }

  try {
    if (provider === "openai") {
      return await streamOpenAI(apiKey, model, systemPrompt, userContent, maxTokens);
    } else if (provider === "gemini") {
      return await streamGemini(apiKey, model, systemPrompt, userContent, maxTokens);
    } else {
      return await streamClaude(apiKey, model, systemPrompt, userContent, maxTokens);
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
  apiKey: string, model: string, systemPrompt: string, userContent: string, maxTokens: number
) {
  const client = new Anthropic({ apiKey });
  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens || 1200,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
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
