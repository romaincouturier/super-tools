const MASK = "••••••";

export function maskEmail(value: string | null | undefined): string {
  if (!value) return value ?? "";
  const [local, domain] = value.split("@");
  if (!domain) return MASK;
  const [domainName, tld] = domain.split(".");
  return `${local[0]}${"•".repeat(Math.max(3, local.length - 1))}@${domainName[0]}${"•".repeat(Math.max(2, domainName.length - 1))}.${tld}`;
}

/** Keep first and last letter of each word: "Romain Couturier" → "R••••n C•••••••r" */
function maskWord(word: string): string {
  if (word.length <= 2) return word;
  return word[0] + "•".repeat(word.length - 2) + word[word.length - 1];
}

export function maskName(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return value.split(/(\s+)/).map((part) => /\s+/.test(part) ? part : maskWord(part)).join("");
}

export function maskAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return "•••• €";
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return "•• •• •• •• ••";
}

export function maskApiKey(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return value.substring(0, 4) + "••••••••••••••••";
}

export function maskAddress(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return MASK;
}

export function maskSiren(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return "••• ••• •••";
}

/** Company name: keep first and last letter of each word */
export function maskText(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return value.split(/(\s+)/).map((part) => /\s+/.test(part) ? part : maskWord(part)).join("");
}

/** File name: mask base, keep extension */
export function maskFileName(value: string | null | undefined): string {
  if (!value) return value ?? "";
  const dotIdx = value.lastIndexOf(".");
  if (dotIdx <= 0) return MASK;
  const ext = value.slice(dotIdx);
  return "•".repeat(Math.min(8, dotIdx)) + ext;
}

/**
 * Flou de conteneur, pour le texte libre long qu'aucun mask*() ne peut traiter
 * (résumé, commentaire, note). La valeur réelle reste dans le DOM : réservé à
 * ce qui n'est pas une identité — un nom, un email ou un montant se masquent.
 */
export function demoBlur(
  active: boolean,
  opts?: { lockPointer?: boolean },
): { filter: string; userSelect: "none"; pointerEvents?: "none" } | undefined {
  if (!active) return undefined;
  return {
    filter: "blur(4px)",
    userSelect: "none",
    ...(opts?.lockPointer ? { pointerEvents: "none" as const } : {}),
  };
}

/**
 * Regex des noms clients connus, pour masquer un nom noyé dans un texte libre
 * (titre de carte). Les noms de moins de 3 lettres sont ignorés : trop de
 * faux positifs sur des mots courants.
 */
export function buildKnownNamesMatcher(names: (string | null | undefined)[]): RegExp | null {
  const unique = [...new Set(names.map((n) => (n ?? "").trim()).filter((n) => n.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  if (unique.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${unique.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

/** Masque (maskText) chaque nom connu trouvé dans le texte, le reste intact. */
export function maskKnownNames(value: string | null | undefined, matcher: RegExp | null): string {
  if (!value) return value ?? "";
  if (!matcher) return value;
  return value.replace(matcher, (m) => maskText(m));
}
