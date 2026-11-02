import { describe, it, expect } from "vitest";
import { buildFollowupLines, followupAmount, totalHours, averageHourlyPrice, type TrainingFollowup } from "./quoteFollowup";

const coache: TrainingFollowup = {
  formation_config_id: "c", formation_name: "Formation en ligne à la Facilitation graphique",
  formula_id: "f", formula_name: "Coaché", formula_price: 539, formula_hours: 26.5,
  included_sessions: 2, added_sessions: 3, hourly_rate: 120, single_line: true,
};

describe("quote follow-up sessions", () => {
  it("adds sessions × hourly rate", () => {
    expect(followupAmount(coache)).toBe(360);
  });
  it("adds 1 h per session to the formula duration", () => {
    expect(totalHours(coache)).toBe(29.5);
  });
  it("single line = formula price + sessions with 29,5 h", () => {
    const lines = buildFollowupLines(coache, 20);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit_price_ht).toBe(899);
    expect(lines[0].description).toContain("29,5 h");
    expect(lines[0].description).toContain("dont 3 séances de suivi pédagogique individuel (3 h)");
  });
  it("split mode gives a separate follow-up line", () => {
    const lines = buildFollowupLines({ ...coache, single_line: false }, 20);
    expect(lines).toHaveLength(2);
    expect(lines[0].unit_price_ht).toBe(539);
    expect(lines[1].quantity * lines[1].unit_price_ht).toBe(360);
  });
  it("never writes coaching in client lines", () => {
    for (const single of [true, false]) {
      const text = JSON.stringify(buildFollowupLines({ ...coache, formation_name: "Coaching visuel", single_line: single }, 20));
      expect(text.toLowerCase()).not.toContain("coach");
    }
  });
  it("average hourly price = HT / hours", () => {
    expect(averageHourlyPrice(899, 29.5)).toBe(30.47);
  });
});
