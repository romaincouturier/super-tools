/**
 * Mise en forme du contenu d'un avis pour la description d'une carte CRM.
 *
 * Le contenu vient d'une source externe non contrôlée (flux BOAMP, alerte mail
 * PLACE ou AWS) et finit dans du HTML : il est échappé, et les URL ne sont
 * reprises en lien que si elles sont bien http(s).
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? escapeHtml(parsed.toString())
      : null;
  } catch {
    return null;
  }
}
