/**
 * Alertes d'un post social : règle unique, partagée par l'écran (import
 * relatif depuis src/) et par le MCP. Fonction pure, sans dépendance
 * navigateur ni Deno. Une alerte ne bloque rien.
 */

export type SocialPostAlert =
  | { kind: "missing_visual" }
  | { kind: "text_too_long"; length: number; limit: number; excess: number };

export interface AlertPostInput {
  text: string | null;
  media_id: string | null;
}

export interface AlertChannelInput {
  text_limit: number | null;
}

/** Longueur comptée en points de code : un emoji simple compte pour un. */
export function socialTextLength(text: string | null): number {
  return [...(text ?? "")].length;
}

/** Visuel manquant pour tout canal ; texte trop long seulement si le canal a une limite. */
export function computePostAlerts(post: AlertPostInput, channel: AlertChannelInput | null | undefined): SocialPostAlert[] {
  const alerts: SocialPostAlert[] = [];
  if (!post.media_id) alerts.push({ kind: "missing_visual" });
  const limit = channel?.text_limit ?? null;
  if (limit !== null) {
    const length = socialTextLength(post.text);
    if (length > limit) alerts.push({ kind: "text_too_long", length, limit, excess: length - limit });
  }
  return alerts;
}

/** Entier groupé par milliers avec une espace insécable, indépendamment de la locale de l'environnement. */
function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatAlert(alert: SocialPostAlert): string {
  if (alert.kind === "missing_visual") return "Visuel manquant";
  return `Texte trop long : ${formatCount(alert.length)} / ${formatCount(alert.limit)} (+${formatCount(alert.excess)})`;
}
