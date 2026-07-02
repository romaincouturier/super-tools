import { dateAsISO } from "@/lib/dateFormatters";

export type Period = "7d" | "30d" | "90d" | "365d";

export const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "3 mois",
  "365d": "12 mois",
};

/**
 * Convertit une période en plage de dates ISO.
 * endOffsetDays recule la date de fin (ex: 2 pour Search Console dont les
 * données sont disponibles avec ~2 jours de décalage).
 */
export function periodToRange(period: Period, endOffsetDays = 0): { from: string; to: string; days: number } {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
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
