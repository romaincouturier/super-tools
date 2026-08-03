import { dateAsISO } from "@/lib/dateFormatters";

export type Period = "7d" | "30d" | "90d" | "365d" | "16m";

export const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "3 mois",
  "365d": "12 mois",
  "16m": "16 mois",
};

/** Périodes proposées hors Search Console (pas d'historique 16 mois ailleurs). */
export const DEFAULT_PERIODS: Period[] = ["7d", "30d", "90d", "365d"];

/** Search Console conserve 16 mois d'historique. */
export const GSC_PERIODS: Period[] = ["7d", "30d", "90d", "365d", "16m"];

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  "16m": 487,
};

/**
 * Convertit une période en plage de dates ISO.
 * endOffsetDays recule la date de fin (ex: 2 pour Search Console dont les
 * données sont disponibles avec ~2 jours de décalage).
 */
export function periodToRange(period: Period, endOffsetDays = 0): { from: string; to: string; days: number } {
  const days = PERIOD_DAYS[period] ?? 30;
  const end = new Date();
  end.setDate(end.getDate() - endOffsetDays);
  const from = new Date(end);
  from.setDate(end.getDate() - (days - 1));
  return { from: dateAsISO(from), to: dateAsISO(end), days };
}


export function formatPeriodLabel(from: string, to: string) {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return `${fmt(from)} → ${fmt(to)}`;
}
