/** Suivi pédagogique individuel ajouté à un micro-devis. 1 séance = 1 h, tarif par participant. */
export const FOLLOWUP_SESSION_HOURS = 1;

export interface MicroDevisFollowup {
  addedSessions: number;
  hourlyRate: number;
  singleLine: boolean;
}

export interface MicroDevisItem {
  name: string;
  duration: string;
  quantity: number;
  unit_price: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtH = (n: number) => `${String(n).replace(".", ",")}h`;

/** Client-facing text must never mention coaching. */
export function stripCoaching(text: string): string {
  return text
    .replace(/coaching/gi, "suivi pédagogique individuel")
    .replace(/coac\p{L}*\.*/giu, "avec suivi individuel");
}

export function addedSessions(f?: MicroDevisFollowup | null): number {
  return f ? Math.max(0, Math.floor(f.addedSessions || 0)) : 0;
}

/** Montant ajouté par participant = séances × tarif horaire. */
export function followupAmount(f?: MicroDevisFollowup | null): number {
  return round2(addedSessions(f) * Math.max(0, f?.hourlyRate || 0) * FOLLOWUP_SESSION_HOURS);
}

export function totalHours(baseHours: number, f?: MicroDevisFollowup | null): number {
  return (Number(baseHours) || 0) + addedSessions(f) * FOLLOWUP_SESSION_HOURS;
}

/** Prix moyen HT par heure, par participant (UI uniquement). */
export function averageHourlyPrice(unitPrice: number, baseHours: number, f?: MicroDevisFollowup | null): number | null {
  const h = totalHours(baseHours, f);
  return h > 0 ? round2((unitPrice + followupAmount(f)) / h) : null;
}

const sessionsLabel = (n: number) => `${n} séance${n > 1 ? "s" : ""} de suivi pédagogique individuel`;

export function totalFollowupSessions(includedSessions: number, f?: MicroDevisFollowup | null): number {
  return Math.max(0, Math.floor(Number(includedSessions) || 0)) + addedSessions(f);
}

/** Lignes PDF : frais de dossier fondus dans la ligne formation. */
export function buildMicroDevisItems(p: {
  name: string;
  unitPrice: number;
  baseHours: number;
  quantity: number;
  adminFee: number;
  includedSessions?: number;
  followup?: MicroDevisFollowup | null;
}): MicroDevisItem[] {
  const qty = Math.max(1, p.quantity);
  const n = addedSessions(p.followup);
  const totalSessions = totalFollowupSessions(p.includedSessions ?? 0, p.followup);
  const includedCount = totalFollowupSessions(p.includedSessions ?? 0);
  const amount = followupAmount(p.followup);
  const name = stripCoaching(p.name);
  const feePerUnit = p.adminFee / qty;
  if (n === 0 || p.followup?.singleLine) {
    return [{
      name: totalSessions > 0 ? `${name} (dont ${sessionsLabel(totalSessions)} (${fmtH(totalSessions)}))` : name,
      duration: fmtH(totalHours(p.baseHours, p.followup)),
      quantity: qty,
      unit_price: round2(p.unitPrice + amount + feePerUnit),
    }];
  }
  return [
    { name: includedCount > 0 ? `${name} (dont ${sessionsLabel(includedCount)} (${fmtH(includedCount)}))` : name, duration: fmtH(Number(p.baseHours) || 0), quantity: qty, unit_price: round2(p.unitPrice + feePerUnit) },
    { name: `Suivi pédagogique individuel : ${sessionsLabel(n)} d'1h`, duration: fmtH(n), quantity: qty, unit_price: amount },
  ];
}
