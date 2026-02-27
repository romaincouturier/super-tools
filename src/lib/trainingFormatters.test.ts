import { describe, it, expect } from "vitest";
import {
  calculateTotalDuration,
  formatDateWithSchedule,
  getFormatLabel,
  getSponsorName,
} from "./trainingFormatters";

// ── calculateTotalDuration ───────────────────────────────────────────────────

describe("calculateTotalDuration", () => {
  it("returns 0 for empty schedules", () => {
    expect(calculateTotalDuration([])).toBe(0);
  });

  it("returns 7 for a full-day session (09:00-17:00 = 8h > 4h)", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00", end_time: "17:00" },
      ]),
    ).toBe(7);
  });

  it("returns 3.5 for a half-day session (09:00-12:30 = 3.5h <= 4h)", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00", end_time: "12:30" },
      ]),
    ).toBe(3.5);
  });

  it("returns 3.5 for exactly 4h (boundary: <= 4h)", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00", end_time: "13:00" },
      ]),
    ).toBe(3.5);
  });

  it("returns 7 for just over 4h (boundary: > 4h)", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00", end_time: "13:01" },
      ]),
    ).toBe(7);
  });

  it("sums multiple days correctly", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00", end_time: "17:00" }, // 7
        { start_time: "09:00", end_time: "12:30" }, // 3.5
        { start_time: "09:00", end_time: "17:00" }, // 7
      ]),
    ).toBe(17.5);
  });

  it("handles times with seconds (HH:mm:ss format)", () => {
    expect(
      calculateTotalDuration([
        { start_time: "09:00:00", end_time: "17:00:00" },
      ]),
    ).toBe(7);
  });
});

// ── getFormatLabel ───────────────────────────────────────────────────────────

describe("getFormatLabel", () => {
  it('returns "Intra-entreprise" for "intra"', () => {
    expect(getFormatLabel("intra")).toBe("Intra-entreprise");
  });

  it('returns "Inter-entreprises" for "inter-entreprises"', () => {
    expect(getFormatLabel("inter-entreprises")).toBe("Inter-entreprises");
  });

  it('returns "E-learning" for "e_learning"', () => {
    expect(getFormatLabel("e_learning")).toBe("E-learning");
  });

  it("returns null for null", () => {
    expect(getFormatLabel(null)).toBeNull();
  });

  it("returns null for unknown format", () => {
    expect(getFormatLabel("some_other")).toBeNull();
  });
});

// ── getSponsorName ───────────────────────────────────────────────────────────

describe("getSponsorName", () => {
  it("returns full name when both parts present", () => {
    expect(getSponsorName("Jean", "Dupont")).toBe("Jean Dupont");
  });

  it("returns first name only when last name is null", () => {
    expect(getSponsorName("Jean", null)).toBe("Jean");
  });

  it("returns last name only when first name is null", () => {
    expect(getSponsorName(null, "Dupont")).toBe("Dupont");
  });

  it("returns null when both are null", () => {
    expect(getSponsorName(null, null)).toBeNull();
  });

  it("returns null when both are undefined", () => {
    expect(getSponsorName(undefined, undefined)).toBeNull();
  });
});

// ── formatDateWithSchedule ───────────────────────────────────────────────────

describe("formatDateWithSchedule", () => {
  it("returns single date with time for one-day schedule", () => {
    const result = formatDateWithSchedule("2026-03-15", null, [
      { day_date: "2026-03-15", start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(result).toContain("15");
    expect(result).toContain("mars");
    expect(result).toContain("2026");
    expect(result).toContain("09:00 - 17:00");
  });

  it("shows contiguous range when days are consecutive", () => {
    const result = formatDateWithSchedule("2026-03-15", "2026-03-17", [
      { day_date: "2026-03-15", start_time: "09:00:00", end_time: "17:00:00" },
      { day_date: "2026-03-16", start_time: "09:00:00", end_time: "17:00:00" },
      { day_date: "2026-03-17", start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(result).toMatch(/Du .+ au .+/);
    expect(result).toContain("09:00 - 17:00");
  });

  it("shows day count for non-contiguous days", () => {
    const result = formatDateWithSchedule("2026-03-15", "2026-03-20", [
      { day_date: "2026-03-15", start_time: "09:00:00", end_time: "17:00:00" },
      { day_date: "2026-03-18", start_time: "09:00:00", end_time: "17:00:00" },
      { day_date: "2026-03-20", start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(result).toContain("3 jours");
  });

  it('shows "horaires variables" when times differ across days', () => {
    const result = formatDateWithSchedule("2026-03-15", "2026-03-16", [
      { day_date: "2026-03-15", start_time: "09:00:00", end_time: "17:00:00" },
      { day_date: "2026-03-16", start_time: "10:00:00", end_time: "16:00:00" },
    ]);
    expect(result).toContain("horaires variables");
  });

  it("falls back to start/end dates when no schedules", () => {
    const result = formatDateWithSchedule("2026-03-15", "2026-03-17", []);
    expect(result).toMatch(/Du .+ au .+/);
    expect(result).toContain("2026");
  });

  it("returns single date when no schedules and no end date", () => {
    const result = formatDateWithSchedule("2026-03-15", null, []);
    expect(result).toContain("15");
    expect(result).toContain("mars");
    expect(result).toContain("2026");
  });
});
