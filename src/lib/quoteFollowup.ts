import type { QuoteLineItem } from "@/types/quotes";

/** One follow-up session always lasts one hour. */
export const FOLLOWUP_SESSION_HOURS = 1;
export const FORMATION_LINE_ID = "catalog-formation";
export const FOLLOWUP_LINE_ID = "catalog-followup";

export interface TrainingFollowup {
  formation_config_id: string;
  formation_name: string;
  formula_id: string;
  formula_name: string;
  formula_price: number;
  formula_hours: number;
  included_sessions: number;
  added_sessions: number;
  hourly_rate: number;
  single_line: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function followupAmount(f: Pick<TrainingFollowup, "added_sessions" | "hourly_rate">): number {
  return round2(Math.max(0, f.added_sessions) * Math.max(0, f.hourly_rate) * FOLLOWUP_SESSION_HOURS);
}

export function totalHours(f: Pick<TrainingFollowup, "formula_hours" | "added_sessions">): number {
  return f.formula_hours + Math.max(0, f.added_sessions) * FOLLOWUP_SESSION_HOURS;
}

const fmtH = (n: number) => `${String(n).replace(".", ",")} h`;
const sessionsLabel = (n: number) => `${n} séance${n > 1 ? "s" : ""} de suivi pédagogique individuel`;

/** Client-facing text must never mention coaching. */
export function stripCoaching(text: string): string {
  return text
    .replace(/coaching/gi, "suivi pédagogique individuel")
    .replace(/\bcoach[ée]e?s?\b/gi, "avec suivi individuel");
}

export function buildFollowupLines(f: TrainingFollowup, vatRate: number): QuoteLineItem[] {
  const added = Math.max(0, f.added_sessions);
  const amount = followupAmount(f);
  const hours = totalHours(f);
  const product = stripCoaching(f.formation_name);
  const included = f.included_sessions > 0 ? `, ${sessionsLabel(f.included_sessions)} inclus` : "";
  const mk = (id: string, p: string, d: string, price: number): QuoteLineItem => ({
    id, product: p, description: d, quantity: 1, unit: "forfait", unit_price_ht: price, vat_rate: vatRate,
    total_ht: price, total_ttc: round2(price * (1 + vatRate / 100)),
  });

  if (added === 0 || f.single_line) {
    const desc = added > 0
      ? `Durée : ${fmtH(hours)}${included}, dont ${sessionsLabel(added)} (${fmtH(added * FOLLOWUP_SESSION_HOURS)}) ajoutées`
      : `Durée : ${fmtH(hours)}${included}`;
    return [mk(FORMATION_LINE_ID, product, desc, round2(f.formula_price + amount))];
  }
  return [
    mk(FORMATION_LINE_ID, product, `Durée : ${fmtH(f.formula_hours)}${included}`, round2(f.formula_price)),
    {
      ...mk(FOLLOWUP_LINE_ID, "Suivi pédagogique individuel",
        `${sessionsLabel(added)} d'1 h (${fmtH(added * FOLLOWUP_SESSION_HOURS)})`, f.hourly_rate),
      quantity: added, unit: "heure", total_ht: amount, total_ttc: round2(amount * (1 + vatRate / 100)),
    },
  ];
}

/** Replace previously managed catalog lines; keep the others (travel, custom). */
export function mergeManagedLines(lines: QuoteLineItem[], managed: QuoteLineItem[]): QuoteLineItem[] {
  const others = lines.filter((l) => l.id !== FORMATION_LINE_ID && l.id !== FOLLOWUP_LINE_ID);
  return [...managed, ...others];
}

export function averageHourlyPrice(totalHt: number, hours: number): number | null {
  return hours > 0 ? round2(totalHt / hours) : null;
}
