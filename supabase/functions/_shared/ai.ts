/**
 * Helper IA centralisé — Edge Functions
 *
 * Route les appels de complétion de chat vers le provider choisi dans
 * Paramètres généraux (réglage `ai_provider` dans app_settings).
 *
 * - "lovable" (défaut) : gateway Lovable (OpenAI-compatible) — comportement
 *   historique, aucune régression tant que ce réglage n'est pas changé.
 * - "anthropic" : Claude en direct (clé ANTHROPIC_API_KEY) — Haiku (fast) / Sonnet (smart).
 * - "openai" : OpenAI en direct (clé OPENAI_API_KEY) — gpt-4o-mini (fast) / gpt-4o (smart).
 * - "gemini" : pas encore câblé en direct -> repli sur Lovable pour éviter toute casse.
 *
 * Rollback instantané : repasser le réglage sur "lovable" dans l'UI, sans redeploy.
 */

import { getSupabaseClient } from "./supabase-client.ts";
import { getOpenAIApiKey, getAnthropicApiKey } from "./api-keys.ts";
import { CLAUDE_DEFAULT, CLAUDE_ADVANCED } from "./claude-models.ts";

export type AiTier = "fast" | "smart";
export type AiProvider = "lovable" | "anthropic" | "openai" | "gemini";

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const MODEL_MAP: Record<"lovable" | "anthropic" | "openai", Record<AiTier, string>> = {
  lovable: { fast: "google/gemini-2.5-flash", smart: "google/gemini-2.5-flash" },
  anthropic: { fast: CLAUDE_DEFAULT, smart: CLAUDE_ADVANCED },
  openai: { fast: "gpt-4o-mini", smart: "gpt-4o" },
};

let providerCache: { value: AiProvider; ts: number } | null = null;
const PROVIDER_TTL_MS = 60_000;

export async function getAiProvider(): Promise<AiProvider> {
  const now = Date.now();
  if (providerCache && now - providerCache.ts < PROVIDER_TTL_MS) return providerCache.value;
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ai_provider")
      .maybeSingle();
    const raw = (data?.setting_value || "lovable").trim() as AiProvider;
    const value: AiProvider = ["lovable", "anthropic", "openai", "gemini"].includes(raw) ? raw : "lovable";
    providerCache = { value, ts: now };
    return value;
  } catch {
    return "lovable";
  }
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  messages: AiChatMessage[];
  system?: string;
  tier?: AiTier;
  temperature?: number;
  maxTokens?: number;
  /** Force un provider en ignorant le réglage (rare). */
  provider?: AiProvider;
}

const RETRYABLE = new Set([429, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 4;

async function withRetry(label: string, doFetch: () => Promise<Response>): Promise<Response> {
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await doFetch();
    if (res.ok) return res;
    lastStatus = res.status;
    lastText = await res.text();
    console.error(`[ai] ${label} error (attempt ${attempt}/${MAX_ATTEMPTS}, status ${lastStatus}):`, lastText);
    if (!RETRYABLE.has(lastStatus) || attempt === MAX_ATTEMPTS) break;
    const delay = 1000 * 2 ** (attempt - 1) + Math.random() * 500;
    await new Promise((r) => setTimeout(r, delay));
  }
  if (lastStatus === 529 || lastStatus === 503) {
    throw new Error("Le service IA est temporairement surchargé. Réessayez dans quelques instants.");
  }
  throw new Error(`AI API error: ${lastStatus}`);
}

async function callOpenAICompatible(
  url: string,
  apiKey: string | null | undefined,
  model: string,
  opts: AiChatOptions,
): Promise<string> {
  if (!apiKey) throw new Error(`Clé API manquante pour ${url}`);
  const messages = opts.system
    ? [{ role: "system", content: opts.system }, ...opts.messages]
    : opts.messages;
  const body: Record<string, unknown> = { model, messages };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;

  const res = await withRetry(url, () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    }),
  );
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(model: string, opts: AiChatOptions): Promise<string> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 2048,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await withRetry("anthropic", () =>
    fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    }),
  );
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/**
 * Appel de complétion de chat, routé selon le provider configuré.
 * Renvoie le texte de la réponse (le parsing JSON éventuel reste à l'appelant).
 */
export async function aiChat(opts: AiChatOptions): Promise<string> {
  const tier: AiTier = opts.tier ?? "fast";
  let provider = opts.provider ?? (await getAiProvider());
  // Gemini direct pas encore câblé -> repli Lovable pour éviter toute casse.
  if (provider === "gemini" || !MODEL_MAP[provider as "lovable" | "anthropic" | "openai"]) {
    provider = "lovable";
  }
  const model = MODEL_MAP[provider as "lovable" | "anthropic" | "openai"][tier];

  if (provider === "anthropic") {
    return callAnthropic(model, opts);
  }
  const url = provider === "openai" ? OPENAI_URL : LOVABLE_URL;
  const apiKey = provider === "openai" ? await getOpenAIApiKey() : Deno.env.get("LOVABLE_API_KEY");
  return callOpenAICompatible(url, apiKey, model, opts);
}
