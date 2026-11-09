/**
 * Validation des saisies Picto-Dico (webhook, MCP). Miroir de
 * public.pictodico_word_is_valid / pictodico_text_is_safe : la base rejette
 * de toute façon, ce contrôle évite d'enregistrer quoi que ce soit.
 */
export const PICTO_WORD_MAX = 60;
export const PICTO_TEXT_MAX = 500;

export function isValidPictoWord(raw: string | null | undefined): boolean {
  const w = (raw ?? "").trim();
  if (w.length < 1 || w.length > PICTO_WORD_MAX) return false;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u.test(w)) return false;
  if (/(https?|www|erreur signal|url du mot)/i.test(w)) return false;
  return (w.match(/['’]/g) ?? []).length <= 2;
}

export function isSafePictoText(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  if (raw.length > PICTO_TEXT_MAX) return false;
  if (/[<>{}`\\]/.test(raw)) return false;
  if (/['"();]{3,}/.test(raw)) return false;
  return !/\(\(|\)\)/.test(raw);
}

/** URL de recherche picto-dico.fr attendue : renvoie le mot recherché, sinon null. */
export function extractPictoSearchWord(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/^(www\.)?picto-dico\.fr$/i.test(u.hostname) || !/^https?:$/.test(u.protocol)) return null;
    const w = u.searchParams.get("_sf_s");
    return w ? w.replace(/\s+/g, " ").trim() : null;
  } catch {
    return null;
  }
}
