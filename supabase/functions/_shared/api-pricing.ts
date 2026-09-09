/**
 * Tarifs des APIs payantes — logique pure, sans dépendance réseau.
 *
 * Séparé de `api-usage.ts` parce que celui-ci importe le client Supabase
 * depuis esm.sh, ce qui rend le module inimportable par vitest. Le calcul de
 * coût est la partie qui mérite des tests : une erreur de tarif ne fait rien
 * planter, elle rend simplement le tableau de bord faux.
 *
 * Les tarifs sont en USD par million de tokens. Les tokens sont stockés en
 * parallèle du coût dans `api_usage_events` pour pouvoir recalculer si un
 * tarif change.
 */

export type ApiProvider = "anthropic" | "openai" | "assemblyai" | "lovable" | "gemini";

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
  "claude-sonnet-5": { input: 2, output: 10 },
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

/** Une lecture de cache coûte 0,1x le prix d'un token d'entrée. */
export const ANTHROPIC_CACHE_READ_RATIO = 0.1;

/**
 * Une écriture de cache coûte 1,25x le prix d'un token d'entrée, pour le TTL
 * par défaut de 5 minutes. Le TTL d'une heure se facture 2x : tant que ce
 * second ratio n'est pas géré ici, `ttl: "1h"` est interdit dans les edge
 * functions et `scripts/check-rules.sh` le vérifie. Sans ce garde-fou, activer
 * le TTL long sous-estimerait le coût sans aucun signal.
 */
export const ANTHROPIC_CACHE_WRITE_RATIO = 1.25;

/** `claude-haiku-4-5-20251001` → `claude-haiku-4-5` */
export function normalizeModel(model: string): string {
  return model.trim().replace(/-\d{8}$/, "");
}

/** Tarif d'un modèle, ou `null` s'il n'est pas dans la table. */
export function priceFor(provider: ApiProvider, model: string): TokenPrice | null {
  const key = normalizeModel(model);
  if (provider === "anthropic") return ANTHROPIC_PRICING[key] ?? null;
  if (provider === "openai") return OPENAI_PRICING[key] ?? null;
  if (provider === "lovable" || provider === "gemini") return LOVABLE_PRICING[key] ?? null;
  return null;
}

/** Champs nécessaires au calcul du coût, sous-ensemble d'un événement d'usage. */
export interface CostInput {
  provider: ApiProvider;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  audioSeconds?: number;
  /** Force un coût (sinon calculé depuis les tarifs). */
  costUsd?: number;
}

export function estimateCostUsd(entry: CostInput): number {
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
