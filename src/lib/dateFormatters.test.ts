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
    expect(formatDateWithDayOfWeek("2026-03-15")).toBe("Dimanche 15 mars 2026");
  });

  it("formats Monday correctly", () => {
    // 2026-03-16 is a Monday
    expect(formatDateWithDayOfWeek("2026-03-16")).toBe("Lundi 16 mars 2026");
  });
});

// ── formatDateShort ─────────────────────────────────────────────────────────

describe("formatDateShort", () => {
  it("uses abbreviated month", () => {
    expect(formatDateShort("2026-03-15")).toBe("15 mars 2026");
  });

  it("handles single-digit day", () => {
    expect(formatDateShort("2026-01-05")).toBe("5 janv. 2026");
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
  it("formats local timestamp with 'à'", () => {
    expect(formatDateWithTime("2026-03-15T14:30:00")).toBe("15 mars 2026 à 14:30");
  });

  it("formats midnight correctly", () => {
    expect(formatDateWithTime("2026-03-15T00:00:00")).toBe("15 mars 2026 à 00:00");
  });
});

// ── formatDateTimeSeconds ───────────────────────────────────────────────────

describe("formatDateTimeSeconds", () => {
  it("includes seconds", () => {
    expect(formatDateTimeSeconds("2026-03-15T14:30:45")).toBe("15 mars 2026 à 14:30:45");
  });
});

// ── formatSentDateTime ──────────────────────────────────────────────────────

describe("formatSentDateTime", () => {
  it("shows compact date with time", () => {
    expect(formatSentDateTime("2026-03-15T14:30:00")).toBe("15 mars à 14:30");
  });
});

// ── formatDateTimeShort ─────────────────────────────────────────────────────

describe("formatDateTimeShort", () => {
  it("shows short month with year and time", () => {
    expect(formatDateTimeShort("2026-03-15T14:30:00")).toBe("15 mars 2026 14:30");
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
    expect(formatDateRange("2026-03-01", "2026-03-15")).toBe("1 - 15 mars 2026");
  });

  it("handles cross-month range", () => {
    expect(formatDateRange("2026-03-15", "2026-04-15")).toBe("15 mars - 15 avr. 2026");
  });

  it("handles cross-year range", () => {
    expect(formatDateRange("2025-12-28", "2026-01-05")).toBe("28 déc. - 5 janv. 2026");
  });

  it("returns degenerate range when start equals end", () => {
    // Current behaviour: renders "15 - 15 mars 2026" (not collapsed).
    // Documented here as accepted behaviour.
    expect(formatDateRange("2026-03-15", "2026-03-15")).toBe("15 - 15 mars 2026");
  });
});

// ── formatTrainingDates ─────────────────────────────────────────────────────

describe("formatTrainingDates", () => {
  it('returns "le ..." for single date', () => {
    expect(formatTrainingDates("2026-03-15", null)).toBe("le 15 mars 2026");
  });

  it("uses parseISO to avoid UTC midnight timezone shift", () => {
    // new Date("2026-01-01") would be Dec 31 in UTC-X timezones
    // parseISO("2026-01-01") always gives Jan 1 local time
    expect(formatTrainingDates("2026-01-01", null)).toBe("le 1 janvier 2026");
  });

  it('returns "le ..." when start equals end', () => {
    expect(formatTrainingDates("2026-03-15", "2026-03-15")).toBe("le 15 mars 2026");
  });

  it('returns "du ... au ..." for a range', () => {
    expect(formatTrainingDates("2026-03-15", "2026-03-17")).toBe("du 15 mars 2026 au 17 mars 2026");
  });
});

// ── Defensive: null, undefined, empty, invalid ─────────────────────────────

describe("Defensive behaviour — invalid inputs", () => {
  const functions = [
    { name: "formatDateFr", fn: formatDateFr },
    { name: "formatDateLong", fn: formatDateLong },
    { name: "formatDateWithDayOfWeek", fn: formatDateWithDayOfWeek },
    { name: "formatDateShort", fn: formatDateShort },
    { name: "formatDateSlot", fn: formatDateSlot },
    { name: "formatDateWithTime", fn: formatDateWithTime },
    { name: "formatDateTimeSeconds", fn: formatDateTimeSeconds },
    { name: "formatSentDateTime", fn: formatSentDateTime },
    { name: "formatDateTimeShort", fn: formatDateTimeShort },
  ];

  for (const { name, fn } of functions) {
    it(`${name} throws on null`, () => {
      expect(() => fn(null as unknown as string)).toThrow();
    });

    it(`${name} throws on undefined`, () => {
      expect(() => fn(undefined as unknown as string)).toThrow();
    });

    it(`${name} throws on empty string`, () => {
      expect(() => fn("")).toThrow();
    });

    it(`${name} throws on invalid date string`, () => {
      expect(() => fn("not-a-date")).toThrow();
    });
  }

  it("formatDateRange returns fallback on null start", () => {
    expect(formatDateRange(null as unknown as string, null)).toBe("Formation permanente");
  });

  it("formatTrainingDates returns fallback on null start", () => {
    expect(formatTrainingDates(null as unknown as string, null)).toBe("Formation permanente");
  });

  it("formatTrainingDates handles undefined end date", () => {
    // undefined should behave like null (single date)
    expect(formatTrainingDates("2026-03-15", undefined as unknown as null)).toBe("le 15 mars 2026");
  });
});
