/**
 * Returns 2-letter initials from first/last name. Falls back to `fallback` or "?" when both are empty.
 * Pass `email.slice(0, 2).toUpperCase()` as fallback if an email-based default is needed.
 */
export function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string,
): string {
  const i = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return i || fallback || "?";
}

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
