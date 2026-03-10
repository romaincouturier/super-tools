/** Capitalize each part of a name: "jean-pierre" → "Jean-Pierre", "DE LA FONTAINE" → "De La Fontaine" */
export const capitalizeName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};

/** Normalize email: trim + lowercase */
export const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  return email.trim().toLowerCase();
};
