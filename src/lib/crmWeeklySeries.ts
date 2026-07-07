import { addDays, format, startOfWeek } from "date-fns";

/** Champs minimaux d'une carte CRM nécessaires à la série hebdomadaire. */
export interface WeeklySeriesCard {
  estimated_value: number | null;
  confidence_score: number | null;
  sales_status: string;
  created_at: string;
  won_at: string | null;
  lost_at: string | null;
}

export interface WeeklyPoint {
  week: string; // "dd/MM" label
  weekStart: string; // ISO date
  openValue: number;
  weightedValue: number;
  wonValue: number;
  lostValue: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
}

/**
 * Série hebdomadaire des 12 dernières semaines (lundi → dimanche, heure locale).
 * Sémantique alignée sur les KPIs de useCrmReports :
 * - gagné/perdu : cartes WON/LOST dont won_at/lost_at tombe dans la semaine ;
 * - ouvert en fin de semaine : cartes créées avant la fin de semaine, ni gagnées
 *   ni perdues à cette date. Les cartes CANCELED sont exclues (clôturées sans
 *   issue, pas de date d'annulation exploitable).
 */
export function buildWeeklyTimeSeries(allCards: WeeklySeriesCard[], now: Date = new Date()): WeeklyPoint[] {
  const currentMonday = startOfWeek(now, { weekStartsOn: 1 });

  return Array.from({ length: 12 }, (_, idx) => {
    const start = addDays(currentMonday, -(11 - idx) * 7);
    const end = addDays(start, 6);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    let openValue = 0;
    let weightedValue = 0;
    let wonValue = 0;
    let lostValue = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const card of allCards) {
      const val = card.estimated_value || 0;
      const created = card.created_at?.slice(0, 10) ?? null;
      const won = card.won_at?.slice(0, 10) ?? null;
      const lost = card.lost_at?.slice(0, 10) ?? null;

      if (card.sales_status === "WON" && won && won >= startStr && won <= endStr) {
        wonValue += val;
        wonCount++;
      }

      if (card.sales_status === "LOST" && lost && lost >= startStr && lost <= endStr) {
        lostValue += val;
        lostCount++;
      }

      // Was this card open at end of this week?
      if (card.sales_status !== "CANCELED" && created && created <= endStr) {
        const wasWon = won && won <= endStr;
        const wasLost = lost && lost <= endStr;
        if (!wasWon && !wasLost) {
          openValue += val;
          const confidence = (card.confidence_score ?? 50) / 100;
          weightedValue += val * confidence;
        }
      }
    }

    const conversionRate = wonCount + lostCount > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100)
      : 0;

    return {
      week: format(start, "dd/MM"),
      weekStart: startStr,
      openValue,
      weightedValue,
      wonValue,
      lostValue,
      wonCount,
      lostCount,
      conversionRate,
    };
  });
}
