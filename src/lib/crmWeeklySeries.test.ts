import { describe, it, expect } from "vitest";
import { buildWeeklyTimeSeries, type WeeklySeriesCard } from "./crmWeeklySeries";

// Mercredi 1er juillet 2026, 12:00 locale — la semaine courante démarre le lundi 29/06.
const NOW = new Date(2026, 6, 1, 12, 0, 0);

function card(overrides: Partial<WeeklySeriesCard>): WeeklySeriesCard {
  return {
    estimated_value: 1000,
    confidence_score: null,
    sales_status: "OPEN",
    created_at: "2026-01-05T10:00:00Z",
    won_at: null,
    lost_at: null,
    ...overrides,
  };
}

describe("buildWeeklyTimeSeries", () => {
  it("retourne 12 semaines, la dernière commençant le lundi de la semaine courante", () => {
    const series = buildWeeklyTimeSeries([], NOW);
    expect(series).toHaveLength(12);
    expect(series[11].weekStart).toBe("2026-06-29");
    expect(series[11].week).toBe("29/06");
    // Semaines consécutives espacées de 7 jours
    expect(series[10].weekStart).toBe("2026-06-22");
    expect(series[0].weekStart).toBe("2026-04-13");
  });

  it("démarre la semaine au lundi même quand 'now' est un dimanche", () => {
    const sunday = new Date(2026, 6, 5, 12, 0, 0); // dimanche 5 juillet 2026
    const series = buildWeeklyTimeSeries([], sunday);
    // Le lundi de la semaine du dimanche 5/07 est le 29/06, pas le 6/07
    expect(series[11].weekStart).toBe("2026-06-29");
  });

  it("compte une carte OPEN dans le pipeline ouvert de chaque semaine après sa création", () => {
    const series = buildWeeklyTimeSeries([card({ estimated_value: 500 })], NOW);
    for (const point of series) {
      expect(point.openValue).toBe(500);
      expect(point.weightedValue).toBe(250); // confiance par défaut 50%
    }
  });

  it("pondère le pipeline par confidence_score", () => {
    const series = buildWeeklyTimeSeries([card({ estimated_value: 1000, confidence_score: 80 })], NOW);
    expect(series[11].weightedValue).toBe(800);
  });

  it("exclut les cartes CANCELED du pipeline ouvert", () => {
    const series = buildWeeklyTimeSeries([card({ sales_status: "CANCELED" })], NOW);
    for (const point of series) {
      expect(point.openValue).toBe(0);
      expect(point.weightedValue).toBe(0);
      expect(point.wonCount).toBe(0);
      expect(point.lostCount).toBe(0);
    }
  });

  it("bascule une carte WON du pipeline vers le gagné la semaine du won_at", () => {
    const series = buildWeeklyTimeSeries(
      [card({ sales_status: "WON", estimated_value: 2000, won_at: "2026-06-24T09:00:00Z" })],
      NOW,
    );
    const winWeek = series.find((p) => p.weekStart === "2026-06-22")!;
    expect(winWeek.wonValue).toBe(2000);
    expect(winWeek.wonCount).toBe(1);
    // Encore ouverte la semaine précédente
    const before = series.find((p) => p.weekStart === "2026-06-15")!;
    expect(before.openValue).toBe(2000);
    expect(before.wonCount).toBe(0);
    // Plus ouverte ni gagnée la semaine suivante
    const after = series.find((p) => p.weekStart === "2026-06-29")!;
    expect(after.openValue).toBe(0);
    expect(after.wonValue).toBe(0);
  });

  it("calcule le taux de conversion won / (won + lost) arrondi", () => {
    const cards = [
      card({ sales_status: "WON", won_at: "2026-06-23T00:00:00Z" }),
      card({ sales_status: "WON", won_at: "2026-06-24T00:00:00Z" }),
      card({ sales_status: "LOST", lost_at: "2026-06-25T00:00:00Z" }),
    ];
    const series = buildWeeklyTimeSeries(cards, NOW);
    const week = series.find((p) => p.weekStart === "2026-06-22")!;
    expect(week.wonCount).toBe(2);
    expect(week.lostCount).toBe(1);
    expect(week.conversionRate).toBe(67);
  });

  it("taux de conversion à 0 quand aucune clôture dans la semaine", () => {
    const series = buildWeeklyTimeSeries([card({})], NOW);
    expect(series[11].conversionRate).toBe(0);
  });

  it("n'inclut pas une carte créée après la fin de la semaine", () => {
    const series = buildWeeklyTimeSeries([card({ created_at: "2026-06-30T00:00:00Z" })], NOW);
    const previousWeek = series.find((p) => p.weekStart === "2026-06-22")!;
    expect(previousWeek.openValue).toBe(0);
    const currentWeek = series.find((p) => p.weekStart === "2026-06-29")!;
    expect(currentWeek.openValue).toBe(1000);
  });

  it("ignore les cartes sans created_at pour le pipeline ouvert", () => {
    const series = buildWeeklyTimeSeries([card({ created_at: "" })], NOW);
    expect(series[11].openValue).toBe(0);
  });

  it("traite estimated_value null comme 0", () => {
    const series = buildWeeklyTimeSeries(
      [card({ estimated_value: null, sales_status: "WON", won_at: "2026-06-30T00:00:00Z" })],
      NOW,
    );
    const week = series.find((p) => p.weekStart === "2026-06-29")!;
    expect(week.wonValue).toBe(0);
    expect(week.wonCount).toBe(1);
  });
});
