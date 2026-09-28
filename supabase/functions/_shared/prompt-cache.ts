/**
 * Prompt caching Anthropic — helpers purs (sans import réseau, testables).
 *
 * Le cache est un match de préfixe qui ne s'arrête qu'aux frontières de blocs :
 * un historique envoyé en un seul bloc texte change à chaque tour et ne peut
 * jamais être relu. Découpé en un bloc par message, le préfixe du tour
 * précédent réapparaît à l'identique et le point de cache le retrouve
 * (lookback de 20 blocs).
 */

export type CacheableTextBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Transforme des morceaux de texte en blocs dont la concaténation est
 * strictement égale à `parts.join("")`. Le dernier bloc porte le point de cache
 * si `cacheLast`. Les morceaux vides sont écartés (l'API refuse un bloc vide).
 */
export function textBlocks(parts: string[], cacheLast: boolean): CacheableTextBlock[] {
  const blocks: CacheableTextBlock[] = parts
    .filter((p) => p.length > 0)
    .map((text) => ({ type: "text", text }));
  if (cacheLast && blocks.length > 0) {
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } };
  }
  return blocks;
}

/**
 * Découpe `header + entries.join(separator)` en un morceau par entrée, le
 * séparateur étant porté en tête de chaque morceau après le premier.
 */
export function joinedParts(header: string, entries: string[], separator: string): string[] {
  return entries.map((e, i) => (i === 0 ? header + e : separator + e));
}

export interface ArenaHistoryEntry {
  agentName: string;
  content: string;
  isUser?: boolean;
}

/**
 * `buildSlidingContext` (src/lib/arena/store.ts) remplace les messages anciens
 * par un résumé en tête d'historique dès que la fenêtre est dépassée. Ce résumé
 * change à chaque tour : le préfixe n'est alors plus réutilisable et un point
 * de cache ne ferait que payer l'écriture (1,25x) sans lecture.
 */
export function isArenaHistoryAppendOnly(history: ArenaHistoryEntry[]): boolean {
  const first = history[0];
  return !(first && first.agentName === "Systeme" && first.content.startsWith("[Resume des "));
}

/**
 * Part du prompt servie depuis le cache : lecture / (lecture + écriture + non caché).
 * `input_tokens` ne compte que le reste non caché, d'où la somme des trois.
 */
export function cacheHitRate(usage: {
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  const read = usage.cacheReadTokens ?? 0;
  const total = read + (usage.cacheWriteTokens ?? 0) + (usage.inputTokens ?? 0);
  return total > 0 ? read / total : 0;
}
