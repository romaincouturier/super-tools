import { describe, it, expect } from "vitest";
import {
  formatDateFr,
  formatDateWithDayFr,
  formatDateRange,
  formatDateForFileName,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatICSDate,
  calculateDurationDays,
} from "./date-utils";

// Helper: create dates at noon UTC to avoid timezone edge issues
const d = (s: string) => new Date(`${s}T12:00:00Z`);

// ═══════════════════════════════════════════════════════════════════════
// formatDateFr
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateFr", () => {
  it("formats a standard date", () => {
    expect(formatDateFr(d("2024-01-15"))).toBe("15 janvier 2024");
  });

  it("formats first day of year", () => {
    expect(formatDateFr(d("2024-01-01"))).toBe("1 janvier 2024");
  });

  it("formats last day of year", () => {
    expect(formatDateFr(d("2024-12-31"))).toBe("31 décembre 2024");
  });

  it("accepts string input", () => {
    expect(formatDateFr("2024-06-15T12:00:00Z")).toBe("15 juin 2024");
  });

  it("accepts Date object", () => {
    expect(formatDateFr(d("2024-08-01"))).toBe("1 août 2024");
  });

  it("handles all 12 months", () => {
    const months = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ];
    months.forEach((monthName, i) => {
      const month = String(i + 1).padStart(2, "0");
      expect(formatDateFr(d(`2024-${month}-10`))).toContain(monthName);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatDateWithDayFr
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateWithDayFr", () => {
  it("includes the day name", () => {
    // 2024-01-15 is a Monday
    expect(formatDateWithDayFr(d("2024-01-15"))).toBe("lundi 15 janvier 2024");
  });

  it("handles Sunday", () => {
    // 2024-01-14 is a Sunday
    expect(formatDateWithDayFr(d("2024-01-14"))).toBe("dimanche 14 janvier 2024");
  });

  it("handles Saturday", () => {
    // 2024-01-13 is a Saturday
    expect(formatDateWithDayFr(d("2024-01-13"))).toBe("samedi 13 janvier 2024");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatDateRange
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateRange", () => {
  it("same month and year → compact format", () => {
    expect(formatDateRange(d("2024-01-01"), d("2024-01-03")))
      .toBe("1 au 3 janvier 2024");
  });

  it("different months, same year", () => {
    expect(formatDateRange(d("2024-01-30"), d("2024-02-02")))
      .toBe("30 janvier au 2 février 2024");
  });

  it("different years", () => {
    expect(formatDateRange(d("2024-12-30"), d("2025-01-02")))
      .toBe("30 décembre 2024 au 2 janvier 2025");
  });

  it("single day (start = end)", () => {
    expect(formatDateRange(d("2024-06-15"), d("2024-06-15")))
      .toBe("15 au 15 juin 2024");
  });

  it("accepts string inputs", () => {
    expect(formatDateRange("2024-03-01T00:00:00Z", "2024-03-05T00:00:00Z"))
      .toBe("1 au 5 mars 2024");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatDateForFileName
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateForFileName", () => {
  it("formats date as ISO (YYYY-MM-DD)", () => {
    expect(formatDateForFileName(d("2024-01-15"))).toBe("2024-01-15");
  });

  it("pads single-digit month and day", () => {
    expect(formatDateForFileName(d("2024-03-05"))).toBe("2024-03-05");
  });

  it("accepts string input", () => {
    expect(formatDateForFileName("2024-12-25T12:00:00Z")).toBe("2024-12-25");
  });

  it("uses current date when no argument", () => {
    const result = formatDateForFileName();
    // Should match YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatDateShort
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateShort", () => {
  it("formats as DD/MM/YYYY", () => {
    expect(formatDateShort(d("2024-01-15"))).toBe("15/01/2024");
  });

  it("pads day and month", () => {
    expect(formatDateShort(d("2024-03-05"))).toBe("05/03/2024");
  });

  it("handles end of year", () => {
    expect(formatDateShort(d("2024-12-31"))).toBe("31/12/2024");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatTime
// ═══════════════════════════════════════════════════════════════════════

describe("formatTime", () => {
  it("formats HH:MM as HHhMM", () => {
    expect(formatTime("14:30")).toBe("14h30");
  });

  it("handles midnight", () => {
    expect(formatTime("00:00")).toBe("00h00");
  });

  it("handles noon", () => {
    expect(formatTime("12:00")).toBe("12h00");
  });

  it("handles time with seconds (ignores seconds)", () => {
    expect(formatTime("09:15:30")).toBe("09h15");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatDateTime
// ═══════════════════════════════════════════════════════════════════════

describe("formatDateTime", () => {
  it("combines date and time", () => {
    const result = formatDateTime(new Date(2024, 0, 15, 14, 30));
    expect(result).toBe("15/01/2024 à 14h30");
  });

  it("handles midnight", () => {
    const result = formatDateTime(new Date(2024, 5, 1, 0, 0));
    expect(result).toBe("01/06/2024 à 00h00");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatICSDate
// ═══════════════════════════════════════════════════════════════════════

describe("formatICSDate", () => {
  it("formats date to ICS format", () => {
    const result = formatICSDate(new Date("2024-01-15T14:30:00Z"));
    expect(result).toBe("20240115T143000Z");
  });

  it("handles midnight UTC", () => {
    const result = formatICSDate(new Date("2024-06-01T00:00:00Z"));
    expect(result).toBe("20240601T000000Z");
  });

  it("accepts string input", () => {
    const result = formatICSDate("2024-12-25T18:00:00Z");
    expect(result).toBe("20241225T180000Z");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateDurationDays
// ═══════════════════════════════════════════════════════════════════════

describe("calculateDurationDays", () => {
  it("same day → 1 day", () => {
    expect(calculateDurationDays(d("2024-01-15"), d("2024-01-15"))).toBe(1);
  });

  it("two consecutive days → 2 days", () => {
    expect(calculateDurationDays(d("2024-01-15"), d("2024-01-16"))).toBe(2);
  });

  it("one week → 8 days (inclusive)", () => {
    expect(calculateDurationDays(d("2024-01-15"), d("2024-01-22"))).toBe(8);
  });

  it("works regardless of argument order (abs)", () => {
    const a = calculateDurationDays(d("2024-01-15"), d("2024-01-20"));
    const b = calculateDurationDays(d("2024-01-20"), d("2024-01-15"));
    expect(a).toBe(b);
  });

  it("crosses month boundary", () => {
    expect(calculateDurationDays(d("2024-01-30"), d("2024-02-02"))).toBe(4);
  });

  it("handles leap year February", () => {
    // 2024 is a leap year: Feb 28 to Mar 1 = 3 days
    expect(calculateDurationDays(d("2024-02-28"), d("2024-03-01"))).toBe(3);
  });

  it("handles non-leap year February", () => {
    // 2023 is not a leap year: Feb 28 to Mar 1 = 2 days
    expect(calculateDurationDays(d("2023-02-28"), d("2023-03-01"))).toBe(2);
  });

  it("accepts string inputs", () => {
    expect(calculateDurationDays("2024-01-01T00:00:00Z", "2024-01-31T00:00:00Z")).toBe(31);
  });
});
