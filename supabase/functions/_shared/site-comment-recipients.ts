/** Évaluations antérieures à cette date : hors rattrapage (60 jours avant la mise en place). */
export const SITE_COMMENT_CUTOFF = "2026-09-07T00:00:00Z";

/** Liste d'adresses séparées par virgule, point-virgule ou retour à la ligne, dédoublonnée. */
export function parseEmailList(value: unknown): string[] {
  const raw = typeof value === "string" ? value : Array.isArray(value) ? value.join(",") : "";
  const out = raw.replace(/["']/g, "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(out)];
}

/** Adresses réglées (Paramètres > Général) ; à défaut, l'expéditeur configuré. */
export function siteCommentRecipients(setting: unknown, fallback: string | null | undefined): string[] {
  const list = parseEmailList(setting);
  return list.length ? list : parseEmailList(fallback ?? "");
}
