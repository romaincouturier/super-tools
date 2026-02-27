import { describe, it, expect } from "vitest";
import {
  formatDateFr,
  formatDateLong,
  formatDateWithDayOfWeek,
  formatDateShort,
  formatDateSlot,
  formatDateWithTime,
  formatDateTimeSeconds,
  formatSentDateTime,
  formatDateTimeShort,
  getPeriodLabel,
  formatDateRange,
  formatTrainingDates,
} from "./dateFormatters";

// ── formatDateFr ────────────────────────────────────────────────────────────

describe("formatDateFr", () => {
  it("formats date as dd/MM/yyyy", () => {
    expect(formatDateFr("2026-03-15")).toBe("15/03/2026");
  });

  it("pads single digit day and month", () => {
    expect(formatDateFr("2026-01-05")).toBe("05/01/2026");
  });
});

// ── formatDateLong ──────────────────────────────────────────────────────────

describe("formatDateLong", () => {
  it("formats with full month in French", () => {
    expect(formatDateLong("2026-03-15")).toBe("15 mars 2026");
  });

  it("handles January", () => {
    expect(formatDateLong("2026-01-01")).toBe("1 janvier 2026");
  });
});

// ── formatDateWithDayOfWeek ─────────────────────────────────────────────────

describe("formatDateWithDayOfWeek", () => {
  it("includes day of week in French", () => {
    // 2026-03-15 is a Sunday
    expect(formatDateWithDayOfWeek("2026-03-15")).toBe("dimanche 15 mars 2026");
  });

  it("formats Monday correctly", () => {
    // 2026-03-16 is a Monday
    expect(formatDateWithDayOfWeek("2026-03-16")).toBe("lundi 16 mars 2026");
  });
});

// ── formatDateShort ─────────────────────────────────────────────────────────

describe("formatDateShort", () => {
  it("uses abbreviated month", () => {
    const result = formatDateShort("2026-03-15");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });
});

// ── formatDateSlot ──────────────────────────────────────────────────────────

describe("formatDateSlot", () => {
  it("formats as dd/MM", () => {
    expect(formatDateSlot("2026-03-15")).toBe("15/03");
  });

  it("pads single digits", () => {
    expect(formatDateSlot("2026-01-05")).toBe("05/01");
  });
});

// ── formatDateWithTime ──────────────────────────────────────────────────────

describe("formatDateWithTime", () => {
  it("includes time with 'à'", () => {
    const result = formatDateWithTime("2026-03-15T14:30:00");
    expect(result).toContain("15 mars 2026");
    expect(result).toContain("à");
    expect(result).toContain("14:30");
  });
});

// ── formatDateTimeSeconds ───────────────────────────────────────────────────

describe("formatDateTimeSeconds", () => {
  it("includes seconds", () => {
    const result = formatDateTimeSeconds("2026-03-15T14:30:45");
    expect(result).toContain("15 mars 2026");
    expect(result).toContain("14:30:45");
  });
});

// ── formatSentDateTime ──────────────────────────────────────────────────────

describe("formatSentDateTime", () => {
  it("shows compact date with time", () => {
    const result = formatSentDateTime("2026-03-15T14:30:00");
    expect(result).toContain("15");
    expect(result).toContain("à");
    expect(result).toContain("14:30");
  });
});

// ── formatDateTimeShort ─────────────────────────────────────────────────────

describe("formatDateTimeShort", () => {
  it("shows short month with year and time", () => {
    const result = formatDateTimeShort("2026-03-15T14:30:00");
    expect(result).toContain("15");
    expect(result).toContain("2026");
    expect(result).toContain("14:30");
  });
});

// ── getPeriodLabel ──────────────────────────────────────────────────────────

describe("getPeriodLabel", () => {
  it('returns "Matin" for AM', () => {
    expect(getPeriodLabel("AM")).toBe("Matin");
  });

  it('returns "Après-midi" for PM', () => {
    expect(getPeriodLabel("PM")).toBe("Après-midi");
  });

  it('returns "Après-midi" for any non-AM value', () => {
    expect(getPeriodLabel("other")).toBe("Après-midi");
  });
});

// ── formatDateRange ─────────────────────────────────────────────────────────

describe("formatDateRange", () => {
  it("returns single date when no end date", () => {
    expect(formatDateRange("2026-03-15", null)).toBe("15 mars 2026");
  });

  it("optimises same-month range", () => {
    const result = formatDateRange("2026-03-01", "2026-03-15");
    expect(result).toMatch(/^1 - 15 mars 2026$/);
  });

  it("handles cross-month range", () => {
    const result = formatDateRange("2026-03-15", "2026-04-15");
    expect(result).toContain("15");
    expect(result).toContain("-");
    expect(result).toContain("2026");
  });
});

// ── formatTrainingDates ─────────────────────────────────────────────────────

describe("formatTrainingDates", () => {
  it('returns "le ..." for single date', () => {
    const result = formatTrainingDates("2026-03-15", null);
    expect(result).toBe("le 15 mars 2026");
  });

  it('returns "le ..." when start equals end', () => {
    const result = formatTrainingDates("2026-03-15", "2026-03-15");
    expect(result).toBe("le 15 mars 2026");
  });

  it('returns "du ... au ..." for a range', () => {
    const result = formatTrainingDates("2026-03-15", "2026-03-17");
    expect(result).toMatch(/^du 15 mars 2026 au 17 mars 2026$/);
  });
});
