import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatEntryDate, groupEntriesByDate, isEntryToday } from "./calendarFormatters";
import type { CalendarEntry } from "@/types/calendar";

// Fix time so isToday / isTomorrow are deterministic
const FIXED_NOW = new Date("2026-03-16T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatEntryDate", () => {
  it("returns 'Aujourd'hui' when date is today", () => {
    expect(formatEntryDate("2026-03-16")).toBe("Aujourd'hui");
  });

  it("returns 'Demain' when date is tomorrow", () => {
    expect(formatEntryDate("2026-03-17")).toBe("Demain");
  });

  it("returns formatted date for a future date", () => {
    const result = formatEntryDate("2026-03-20");
    // Should be something like "ven. 20 mars" in French
    expect(result).toContain("20");
    expect(result).toContain("mars");
  });

  it("appends arrow range when endDate differs from date", () => {
    const result = formatEntryDate("2026-03-20", "2026-03-22");
    expect(result).toContain("\u2192");
    expect(result).toContain("22");
  });

  it("does not append range when endDate equals date", () => {
    const result = formatEntryDate("2026-03-20", "2026-03-20");
    expect(result).not.toContain("\u2192");
  });

  it("does not append range when endDate is null", () => {
    const result = formatEntryDate("2026-03-20", null);
    expect(result).not.toContain("\u2192");
  });

  it("does not append range when endDate is undefined", () => {
    const result = formatEntryDate("2026-03-20", undefined);
    expect(result).not.toContain("\u2192");
  });
});

describe("groupEntriesByDate", () => {
  const makeEntry = (id: string, date: string): CalendarEntry => ({
    id,
    type: "formation",
    title: `Entry ${id}`,
    date,
    path: `/test/${id}`,
  });

  it("groups entries by their date", () => {
    const entries = [
      makeEntry("1", "2026-03-16"),
      makeEntry("2", "2026-03-16"),
      makeEntry("3", "2026-03-17"),
    ];
    const result = groupEntriesByDate(entries);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe("2026-03-16");
    expect(result[0][1]).toHaveLength(2);
    expect(result[1][0]).toBe("2026-03-17");
    expect(result[1][1]).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(groupEntriesByDate([])).toEqual([]);
  });

  it("preserves insertion order of dates", () => {
    const entries = [
      makeEntry("1", "2026-03-18"),
      makeEntry("2", "2026-03-16"),
      makeEntry("3", "2026-03-18"),
    ];
    const result = groupEntriesByDate(entries);
    expect(result[0][0]).toBe("2026-03-18");
    expect(result[1][0]).toBe("2026-03-16");
  });
});

describe("isEntryToday", () => {
  it("returns true for today's date", () => {
    expect(isEntryToday("2026-03-16")).toBe(true);
  });

  it("returns false for a different date", () => {
    expect(isEntryToday("2026-03-15")).toBe(false);
  });
});
