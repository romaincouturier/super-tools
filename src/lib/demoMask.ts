const MASK = "••••••";

export function maskEmail(value: string | null | undefined): string {
  if (!value) return value ?? "";
  const [local, domain] = value.split("@");
  if (!domain) return MASK;
  const [domainName, tld] = domain.split(".");
  return `${local[0]}${"•".repeat(Math.max(3, local.length - 1))}@${domainName[0]}${"•".repeat(Math.max(2, domainName.length - 1))}.${tld}`;
}

export function maskName(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return MASK;
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

/** Generic text mask — use for company names, misc sensitive text */
export function maskText(value: string | null | undefined): string {
  if (!value) return value ?? "";
  return MASK;
}
