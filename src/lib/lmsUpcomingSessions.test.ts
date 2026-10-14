import { describe, it, expect } from "vitest";
import { extractCity, formatSessionDays } from "./lmsUpcomingSessions";

describe("formatSessionDays", () => {
  it("formats two consecutive days", () => {
    expect(formatSessionDays({ start_date: "2026-11-16", end_date: "2026-11-17", day_dates: null }, 2026)).toBe("16 et 17 nov.");
  });
  it("adds the year when different", () => {
    expect(formatSessionDays({ start_date: "2027-01-28", end_date: "2027-01-29", day_dates: null }, 2026)).toBe("28 et 29 janv. 2027");
  });
  it("uses schedules and ranges", () => {
    expect(formatSessionDays({ start_date: "2026-11-30", end_date: null, day_dates: ["2026-12-01", "2026-11-30", "2026-12-02"] }, 2026)).toBe("30 nov. au 2 déc.");
    expect(formatSessionDays({ start_date: "2026-11-02", end_date: null, day_dates: ["2026-11-02", "2026-11-09"] }, 2026)).toBe("2 et 9 nov.");
  });
});

describe("extractCity", () => {
  it("reads the city from an address or a label", () => {
    expect(extractCity("Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris")).toBe("Paris");
    expect(extractCity("Espace Gailleton — Lyon")).toBe("Lyon");
    expect(extractCity("Toulouse")).toBe("Toulouse");
  });
});
