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
 * - Le coût est calculé à l'écriture, à partir des tarifs de `api-pricing.ts`.
 *   Les tokens sont stockés en parallèle pour pouvoir recalculer si les tarifs
 *   changent.
 */

import { getSupabaseClient } from "./supabase-client.ts";
import { estimateCostUsd, type ApiProvider, type CostInput } from "./api-pricing.ts";

export type { ApiProvider };
export { estimateCostUsd };
export type TriggerSource = "user" | "cron" | "webhook" | "trigger" | "unknown";

/** Bloc `usage` renvoyé par l'API Anthropic (ou accumulé en streaming). */
export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * Étend `CostInput` : tout champ qui entre dans le calcul du coût est hérité,
 * pour qu'un tarif ajouté dans `api-pricing.ts` ne puisse pas rester sans
 * champ correspondant ici.
 */
export interface ApiUsageEntry extends CostInput {
  /** Nom de l'edge function, ex: "agent-chat". */
  origin: string;
  /** Sous-opération dans la function, ex: "chat", "title". */
  operation?: string;
  trigger?: TriggerSource;
  userId?: string | null;
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
