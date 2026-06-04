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
