/**
 * Traçage de la consommation des APIs payantes — Edge Functions
 *
 * Chaque appel sortant facturé (Anthropic, OpenAI, AssemblyAI, gateway Lovable)
 * écrit une ligne dans `api_usage_events`. L'onglet Monitoring → Usage lit ces
 * lignes pour répondre à « quelle origine brûle les crédits ».
 *
 * Règles :
 * - L'écriture est best-effort : jamais bloquante, jamais throwante. Un échec
 *   de log ne doit pas faire tomber la fonction métier.
 * - Le coût est calculé à l'écriture, à partir des tarifs ci-dessous. Les
 *   tokens sont stockés en parallèle pour pouvoir recalculer si les tarifs
 *   changent.
 */

import { getSupabaseClient } from "./supabase-client.ts";

export type ApiProvider = "anthropic" | "openai" | "assemblyai" | "lovable" | "gemini";
export type TriggerSource = "user" | "cron" | "webhook" | "trigger" | "unknown";

// ── Tarifs, en USD par million de tokens ─────────────────────────────

interface TokenPrice {
  input: number;
  output: number;
}

const ANTHROPIC_PRICING: Record<string, TokenPrice> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const OPENAI_PRICING: Record<string, TokenPrice> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

// Gateway Lovable : facturée en crédits Lovable, pas en USD. On applique les
// tarifs publics Google du modèle sous-jacent pour obtenir un ordre de grandeur
// comparable aux autres providers.
const LOVABLE_PRICING: Record<string, TokenPrice> = {
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
};

// AssemblyAI Universal : facturé à la durée d'audio.
const ASSEMBLYAI_USD_PER_HOUR = 0.27;

const ANTHROPIC_CACHE_READ_RATIO = 0.1;
const ANTHROPIC_CACHE_WRITE_RATIO = 1.25;

/** `claude-haiku-4-5-20251001` → `claude-haiku-4-5` */
function normalizeModel(model: string): string {
  return model.trim().replace(/-\d{8}$/, "");
}

function priceFor(provider: ApiProvider, model: string): TokenPrice | null {
  const key = normalizeModel(model);
  if (provider === "anthropic") return ANTHROPIC_PRICING[key] ?? null;
  if (provider === "openai") return OPENAI_PRICING[key] ?? null;
  if (provider === "lovable" || provider === "gemini") return LOVABLE_PRICING[key] ?? null;
  return null;
}

/** Bloc `usage` renvoyé par l'API Anthropic (ou accumulé en streaming). */
export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ApiUsageEntry {
  provider: ApiProvider;
  /** Nom de l'edge function, ex: "agent-chat". */
  origin: string;
  /** Sous-opération dans la function, ex: "chat", "title". */
  operation?: string;
  model?: string;
  trigger?: TriggerSource;
  userId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  audioSeconds?: number;
  durationMs?: number;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  /**
   * Identifiant de l'unité facturée chez le provider (ex: transcript_id
   * AssemblyAI). À renseigner dès que la ressource peut être relue plusieurs
   * fois : un index unique garantit alors un seul événement de coût.
   */
  externalId?: string | null;
  /** Force un coût (sinon calculé depuis les tarifs). */
  costUsd?: number;
}

export function estimateCostUsd(entry: ApiUsageEntry): number {
  if (entry.costUsd !== undefined) return entry.costUsd;

  if (entry.provider === "assemblyai") {
    return ((entry.audioSeconds ?? 0) / 3600) * ASSEMBLYAI_USD_PER_HOUR;
  }

  const price = priceFor(entry.provider, entry.model ?? "");
  if (!price) return 0;

  const perToken = (n: number, usdPerMillion: number) => (n / 1_000_000) * usdPerMillion;
  return (
    perToken(entry.inputTokens ?? 0, price.input) +
    perToken(entry.outputTokens ?? 0, price.output) +
    perToken(entry.cacheReadTokens ?? 0, price.input * ANTHROPIC_CACHE_READ_RATIO) +
    perToken(entry.cacheWriteTokens ?? 0, price.input * ANTHROPIC_CACHE_WRITE_RATIO)
  );
}

/**
 * Écrit un événement de consommation. Best-effort : n'attend pas la réponse
 * réseau côté appelant si celui-ci ne l'await pas, et n'échoue jamais.
 */
export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("api_usage_events").insert({
      provider: entry.provider,
      external_id: entry.externalId ?? null,
      origin: entry.origin,
      operation: entry.operation ?? null,
      model: entry.model ?? null,
      trigger_source: entry.trigger ?? "unknown",
      user_id: entry.userId ?? null,
      input_tokens: Math.round(entry.inputTokens ?? 0),
      output_tokens: Math.round(entry.outputTokens ?? 0),
      cache_read_tokens: Math.round(entry.cacheReadTokens ?? 0),
      cache_write_tokens: Math.round(entry.cacheWriteTokens ?? 0),
      audio_seconds: entry.audioSeconds ?? null,
      cost_usd: Number(estimateCostUsd(entry).toFixed(6)),
      duration_ms: entry.durationMs ?? null,
      status: entry.status ?? "success",
      error_message: entry.errorMessage ?? null,
      metadata: entry.metadata ?? {},
    });
    // 23505 = violation d'unicité sur (provider, external_id) : la ressource a
    // déjà été facturée et relue. C'est la déduplication qui fait son travail,
    // pas une erreur — ne pas polluer les logs.
    if (error && error.code !== "23505") {
      console.error("[api-usage] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[api-usage] log failed:", e instanceof Error ? e.message : e);
  }
}

/** Raccourci pour un appel Anthropic : mappe le bloc `usage` de la réponse. */
export function logAnthropicUsage(opts: {
  origin: string;
  operation?: string;
  model: string;
  usage?: AnthropicUsage | null;
  trigger?: TriggerSource;
  userId?: string | null;
  durationMs?: number;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return logApiUsage({
    provider: "anthropic",
    origin: opts.origin,
    operation: opts.operation,
    model: opts.model,
    trigger: opts.trigger,
    userId: opts.userId,
    inputTokens: opts.usage?.input_tokens ?? 0,
    outputTokens: opts.usage?.output_tokens ?? 0,
    cacheReadTokens: opts.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: opts.usage?.cache_creation_input_tokens ?? 0,
    durationMs: opts.durationMs,
    status: opts.status,
    errorMessage: opts.errorMessage,
    metadata: opts.metadata,
  });
}

/** Raccourci pour une transcription AssemblyAI (durée en millisecondes). */
export function logAssemblyAiUsage(opts: {
  origin: string;
  operation?: string;
  /**
   * Identifiant du transcript AssemblyAI. AssemblyAI facture une fois, à la
   * soumission ; relire le résultat est gratuit. Le transmettre est ce qui
   * empêche un job relu (webhook + cron) d'être compté plusieurs fois.
   */
  transcriptId?: string | null;
  audioDurationMs?: number | null;
  audioSeconds?: number | null;
  trigger?: TriggerSource;
  userId?: string | null;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const seconds = opts.audioSeconds ?? (opts.audioDurationMs ? opts.audioDurationMs / 1000 : 0);
  return logApiUsage({
    provider: "assemblyai",
    origin: opts.origin,
    operation: opts.operation ?? "transcript",
    model: "universal",
    trigger: opts.trigger,
    userId: opts.userId,
    externalId: opts.transcriptId ?? null,
    audioSeconds: seconds,
    status: opts.status,
    errorMessage: opts.errorMessage,
    metadata: opts.metadata,
  });
}

/** Raccourci pour un appel embeddings OpenAI. */
export function logEmbeddingUsage(opts: {
  origin: string;
  model: string;
  totalTokens: number;
  trigger?: TriggerSource;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return logApiUsage({
    provider: "openai",
    origin: opts.origin,
    operation: "embedding",
    model: opts.model,
    trigger: opts.trigger,
    inputTokens: opts.totalTokens,
    metadata: opts.metadata,
  });
}

/**
 * Raccourci pour un appel au gateway IA Lovable (format OpenAI-compatible).
 * Le gateway est facturé en crédits Lovable : le coût affiché est une
 * estimation aux tarifs publics du modèle sous-jacent.
 */
export function logLovableUsage(opts: {
  origin: string;
  operation?: string;
  /** Réponse JSON du gateway. */
  data?: { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  trigger?: TriggerSource;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return logApiUsage({
    provider: "lovable",
    origin: opts.origin,
    operation: opts.operation,
    model: opts.data?.model || "google/gemini-2.5-flash",
    trigger: opts.trigger,
    userId: opts.userId,
    inputTokens: opts.data?.usage?.prompt_tokens ?? 0,
    outputTokens: opts.data?.usage?.completion_tokens ?? 0,
    metadata: opts.metadata,
  });
}
