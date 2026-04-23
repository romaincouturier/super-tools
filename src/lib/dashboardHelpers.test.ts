import { describe, it, expect } from "vitest";
import {
  buildKpis,
  durationLabel,
  formatEur,
  formatToday,
  greetingFor,
  toHourMin,
  type DashboardKpiSource,
} from "./dashboardHelpers";

// ── formatEur ────────────────────────────────────────────────────────────────

describe("formatEur", () => {
  it("formats whole euros in fr-FR locale", () => {
    // Non-breaking space between digits and currency in fr-FR output
    expect(formatEur(48320)).toMatch(/^48\s?320\s€$/);
  });

  it("rounds to the nearest integer", () => {
    expect(formatEur(1234.49)).toMatch(/^1\s?234\s€$/);
    expect(formatEur(1234.5)).toMatch(/^1\s?235\s€$/);
  });

  it("formats zero", () => {
    expect(formatEur(0)).toMatch(/^0\s€$/);
  });
});

// ── toHourMin ────────────────────────────────────────────────────────────────

describe("toHourMin", () => {
  it("keeps well-formed HH:MM inputs untouched", () => {
    expect(toHourMin("09:30")).toBe("09:30");
    expect(toHourMin("14:05")).toBe("14:05");
  });

  it("pads single digit hour", () => {
    expect(toHourMin("9:30")).toBe("09:30");
  });

  it("trims seconds from HH:MM:SS", () => {
    expect(toHourMin("09:30:00")).toBe("09:30");
  });

  it("falls back when input is null or empty", () => {
    expect(toHourMin(null)).toBe("--:--");
    expect(toHourMin("")).toBe("--:--");
  });

  it("defaults minutes when only hour provided", () => {
    expect(toHourMin("14")).toBe("14:00");
  });
});

// ── durationLabel ────────────────────────────────────────────────────────────

describe("durationLabel", () => {
  it("returns an empty string when either bound is missing", () => {
    expect(durationLabel(null, "10:00")).toBe("");
    expect(durationLabel("09:00", null)).toBe("");
    expect(durationLabel(null, null)).toBe("");
  });

  it("formats durations under an hour in minutes", () => {
    expect(durationLabel("09:00", "09:45")).toBe("45 min");
  });

  it("formats round-hour durations without minutes", () => {
    expect(durationLabel("09:00", "10:00")).toBe("1h");
    expect(durationLabel("14:00", "17:00")).toBe("3h");
  });

  it("formats mixed hour/minute durations", () => {
    expect(durationLabel("09:00", "10:30")).toBe("1h30");
    expect(durationLabel("14:00", "15:05")).toBe("1h05");
  });

  it("returns empty when end is before start", () => {
    expect(durationLabel("10:00", "09:00")).toBe("");
  });

  it("returns empty when bounds are identical", () => {
    expect(durationLabel("10:00", "10:00")).toBe("");
  });
});

// ── greetingFor ──────────────────────────────────────────────────────────────

describe("greetingFor", () => {
  it("greets with Bonjour before noon", () => {
    expect(greetingFor(0)).toBe("Bonjour");
    expect(greetingFor(8)).toBe("Bonjour");
    expect(greetingFor(11)).toBe("Bonjour");
  });

  it("greets with Bon après-midi from noon until 6pm", () => {
    expect(greetingFor(12)).toBe("Bon après-midi");
    expect(greetingFor(15)).toBe("Bon après-midi");
    expect(greetingFor(17)).toBe("Bon après-midi");
  });

  it("greets with Bonsoir from 6pm onwards", () => {
    expect(greetingFor(18)).toBe("Bonsoir");
    expect(greetingFor(22)).toBe("Bonsoir");
  });
});

// ── formatToday ──────────────────────────────────────────────────────────────

describe("formatToday", () => {
  it("formats in French with weekday, day, month and year", () => {
    const date = new Date(2026, 3, 21); // 21 avril 2026
    const formatted = formatToday(date);
    expect(formatted).toMatch(/mardi/i);
    expect(formatted).toMatch(/21/);
    expect(formatted).toMatch(/avril/i);
    expect(formatted).toMatch(/2026/);
  });
});

// ── buildKpis ────────────────────────────────────────────────────────────────

const baseSource: DashboardKpiSource = {
  caSignedThisMonth: 0,
  caSignedLastMonth: 0,
  activeMissions: 0,
  newMissionsThisWeek: 0,
  upcomingTrainings: 0,
  upcomingThisWeek: 0,
  openQuotes: 0,
};

describe("buildKpis", () => {
  it("produces four KPIs in a stable order", () => {
    const kpis = buildKpis(baseSource);
    expect(kpis.map((k) => k.id)).toEqual(["ca", "missions", "formations", "devis"]);
  });

  it("reports upward CA trend with positive delta % when both months have revenue", () => {
    const kpis = buildKpis({ ...baseSource, caSignedThisMonth: 12000, caSignedLastMonth: 10000 });
    const ca = kpis.find((k) => k.id === "ca")!;
    expect(ca.trend).toBe("up");
    expect(ca.delta).toBe("+20.0 %");
  });

  it("flags a CA warn trend when the drop exceeds 10 %", () => {
    const kpis = buildKpis({ ...baseSource, caSignedThisMonth: 8000, caSignedLastMonth: 10000 });
    const ca = kpis.find((k) => k.id === "ca")!;
    expect(ca.trend).toBe("warn");
    expect(ca.delta).toBe("-20.0 %");
  });

  it("treats a flat or tiny CA variation as flat", () => {
    const kpis = buildKpis({ ...baseSource, caSignedThisMonth: 9500, caSignedLastMonth: 10000 });
    const ca = kpis.find((k) => k.id === "ca")!;
    expect(ca.trend).toBe("flat");
  });

  it("returns em dash delta when there is no revenue at all", () => {
    const ca = buildKpis(baseSource).find((k) => k.id === "ca")!;
    expect(ca.delta).toBe("—");
    expect(ca.trend).toBe("flat");
  });

  it("treats the first month with revenue as a full 100 % upswing", () => {
    const kpis = buildKpis({ ...baseSource, caSignedThisMonth: 5000, caSignedLastMonth: 0 });
    const ca = kpis.find((k) => k.id === "ca")!;
    expect(ca.trend).toBe("up");
    expect(ca.delta).toBe("+100.0 %");
  });

  it("pluralises the missions delta", () => {
    const one = buildKpis({ ...baseSource, newMissionsThisWeek: 1 }).find((k) => k.id === "missions")!;
    const many = buildKpis({ ...baseSource, newMissionsThisWeek: 3 }).find((k) => k.id === "missions")!;
    expect(one.delta).toBe("1 nouvelle");
    expect(many.delta).toBe("3 nouvelles");
  });

  it("uses a dashed placeholder when no new missions this week", () => {
    const none = buildKpis({ ...baseSource, activeMissions: 7 }).find((k) => k.id === "missions")!;
    expect(none.delta).toBe("— cette semaine");
    expect(none.trend).toBe("flat");
  });

  it("surfaces upcoming trainings this week in the delta", () => {
    const kpi = buildKpis({ ...baseSource, upcomingTrainings: 12, upcomingThisWeek: 3 })
      .find((k) => k.id === "formations")!;
    expect(kpi.value).toBe("12");
    expect(kpi.delta).toBe("3 cette semaine");
  });

  it("says nothing is due when there are no upcoming trainings this week", () => {
    const kpi = buildKpis({ ...baseSource, upcomingTrainings: 5 }).find((k) => k.id === "formations")!;
    expect(kpi.delta).toBe("aucune cette semaine");
  });

  it("turns the devis KPI into a warn when the backlog grows large", () => {
    const warn = buildKpis({ ...baseSource, openQuotes: 4 }).find((k) => k.id === "devis")!;
    expect(warn.trend).toBe("warn");
    expect(warn.delta).toBe("à suivre");
  });

  it("keeps the devis KPI flat when the backlog is cleared", () => {
    const empty = buildKpis({ ...baseSource, openQuotes: 0 }).find((k) => k.id === "devis")!;
    expect(empty.trend).toBe("flat");
    expect(empty.delta).toBe("tout est à jour");
  });

  it("always yields a sparkline with at least two points per KPI", () => {
    const kpis = buildKpis(baseSource);
    for (const kpi of kpis) {
      expect(kpi.spark.length).toBeGreaterThanOrEqual(2);
      expect(kpi.spark.every((v) => typeof v === "number" && !Number.isNaN(v))).toBe(true);
    }
  });
});
