/**
 * Integration tests: verify that migrated files use shared dateFormatters
 * and that formatters handle real Supabase data shapes correctly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
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

// ── Helper ──────────────────────────────────────────────────────────────────

/** Read a source file relative to project root. */
function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, "../..", relativePath), "utf-8");
}

// ── 1. Supabase data shapes ────────────────────────────────────────────────
// Supabase returns dates and timestamps in these formats depending on column type.

describe("Supabase data format compatibility", () => {
  describe("date columns (YYYY-MM-DD)", () => {
    const dateOnly = "2026-03-15";

    it("formatDateFr handles date-only", () => {
      expect(formatDateFr(dateOnly)).toBe("15/03/2026");
    });

    it("formatDateLong handles date-only", () => {
      expect(formatDateLong(dateOnly)).toBe("15 mars 2026");
    });

    it("formatDateWithDayOfWeek handles date-only", () => {
      expect(formatDateWithDayOfWeek(dateOnly)).toBe("dimanche 15 mars 2026");
    });

    it("formatDateSlot handles date-only", () => {
      expect(formatDateSlot(dateOnly)).toBe("15/03");
    });

    it("formatDateRange handles date-only start", () => {
      expect(formatDateRange(dateOnly, null)).toBe("15 mars 2026");
    });

    it("formatTrainingDates handles date-only", () => {
      expect(formatTrainingDates(dateOnly, null)).toBe("le 15 mars 2026");
    });
  });

  describe("timestamptz columns (ISO 8601 with offset)", () => {
    const utcTimestamp = "2026-03-15T14:30:00+00:00";
    const utcZ = "2026-03-15T14:30:00Z";
    const parisOffset = "2026-03-15T14:30:00+01:00";

    it("formatDateWithTime handles +00:00 offset", () => {
      const result = formatDateWithTime(utcTimestamp);
      expect(result).toContain("mars 2026");
      expect(result).toContain("à");
    });

    it("formatDateWithTime handles Z suffix", () => {
      const result = formatDateWithTime(utcZ);
      expect(result).toContain("mars 2026");
      expect(result).toContain("à");
    });

    it("formatDateWithTime handles +01:00 offset", () => {
      const result = formatDateWithTime(parisOffset);
      expect(result).toContain("mars 2026");
      expect(result).toContain("à");
    });

    it("formatDateTimeSeconds handles timestamptz", () => {
      const result = formatDateTimeSeconds("2026-03-15T14:30:45+00:00");
      expect(result).toContain("mars 2026");
      expect(result).toContain("14:30:45");
    });

    it("formatSentDateTime handles timestamptz", () => {
      const result = formatSentDateTime("2026-03-15T14:30:00+00:00");
      expect(result).toContain("à");
    });

    it("formatDateTimeShort handles timestamptz", () => {
      const result = formatDateTimeShort("2026-03-15T14:30:00+00:00");
      expect(result).toContain("2026");
    });
  });

  describe("timestamp without tz (ISO 8601 no offset)", () => {
    const localTimestamp = "2026-03-15T14:30:00";

    it("formatDateWithTime treats as local time", () => {
      const result = formatDateWithTime(localTimestamp);
      expect(result).toContain("15 mars 2026");
      expect(result).toContain("14:30");
    });

    it("formatDateTimeSeconds treats as local time", () => {
      const result = formatDateTimeSeconds("2026-03-15T14:30:45");
      expect(result).toContain("15 mars 2026");
      expect(result).toContain("14:30:45");
    });
  });

  describe("time columns (HH:mm:ss)", () => {
    it("getPeriodLabel returns Matin for AM", () => {
      expect(getPeriodLabel("AM")).toBe("Matin");
    });

    it("getPeriodLabel returns Après-midi for PM", () => {
      expect(getPeriodLabel("PM")).toBe("Après-midi");
    });
  });
});

// ── 2. Component-specific edge cases ───────────────────────────────────────

describe("Component-specific integration", () => {
  describe("Formations.tsx – formatDateRange", () => {
    it("same month optimisation", () => {
      expect(formatDateRange("2026-03-01", "2026-03-15")).toBe("1 - 15 mars 2026");
    });

    it("cross-month range", () => {
      const result = formatDateRange("2026-03-28", "2026-04-02");
      expect(result).toMatch(/-/);
      expect(result).toContain("2026");
    });

    it("cross-year range", () => {
      const result = formatDateRange("2025-12-28", "2026-01-05");
      expect(result).toMatch(/-/);
      expect(result).toContain("2026");
    });
  });

  describe("Evaluation.tsx / SponsorEvaluation.tsx – formatTrainingDates", () => {
    it("single-day training", () => {
      expect(formatTrainingDates("2026-06-15", "2026-06-15")).toBe("le 15 juin 2026");
    });

    it("multi-day training", () => {
      expect(formatTrainingDates("2026-06-15", "2026-06-17")).toBe("du 15 juin 2026 au 17 juin 2026");
    });

    it("null end date", () => {
      expect(formatTrainingDates("2026-06-15", null)).toBe("le 15 juin 2026");
    });
  });

  describe("Emargement.tsx – formatDateWithDayOfWeek for schedule_date", () => {
    it("formats a Monday schedule date", () => {
      expect(formatDateWithDayOfWeek("2026-03-16")).toBe("lundi 16 mars 2026");
    });

    it("formats a Saturday schedule date", () => {
      expect(formatDateWithDayOfWeek("2026-03-21")).toBe("samedi 21 mars 2026");
    });
  });

  describe("AttendanceSignatureBlock.tsx – formatDateSlot + getPeriodLabel", () => {
    it("slot label for morning half-day", () => {
      const slot = `${formatDateSlot("2026-03-15")} ${getPeriodLabel("AM")}`;
      expect(slot).toBe("15/03 Matin");
    });

    it("slot label for afternoon half-day", () => {
      const slot = `${formatDateSlot("2026-03-15")} ${getPeriodLabel("PM")}`;
      expect(slot).toBe("15/03 Après-midi");
    });
  });

  describe("DocumentsManager.tsx – formatSentDateTime + formatDateTimeSeconds", () => {
    it("sent date compact display", () => {
      const result = formatSentDateTime("2026-03-15T09:45:00");
      expect(result).toContain("à");
      expect(result).toContain("09:45");
    });

    it("full date with seconds for tooltip", () => {
      const result = formatDateTimeSeconds("2026-03-15T09:45:32");
      expect(result).toContain("15 mars 2026");
      expect(result).toContain("09:45:32");
    });
  });
});

// ── 3. No inline formatting in migrated files ──────────────────────────────
// Static analysis: ensure migrated files don't define local date formatters.

describe("No inline date formatting in migrated files", () => {
  const migratedFiles = [
    "src/pages/Formations.tsx",
    "src/pages/Evaluation.tsx",
    "src/pages/SponsorEvaluation.tsx",
    "src/pages/Emargement.tsx",
    "src/pages/Events.tsx",
    "src/pages/EventDetail.tsx",
    "src/pages/TrainingSummary.tsx",
    "src/pages/Questionnaire.tsx",
    "src/components/formations/DocumentsManager.tsx",
  ];

  // Patterns that indicate inline date formatting (should have been replaced)
  const inlinePatterns = [
    /const formatDateFr\s*=/,
    /const formatDateLong\s*=/,
    /const formatFullDate\s*=\s*\(/,
    /const formatSentDate\s*=\s*\(/,
    /const formatDateRange\s*=\s*\(/,
    /const getPeriodLabel\s*=\s*\(\s*period/,
    /const formatDate\s*=\s*\(\s*dateStr/,
  ];

  for (const file of migratedFiles) {
    it(`${file} has no inline date formatter definitions`, () => {
      const source = readSource(file);
      for (const pattern of inlinePatterns) {
        expect(source).not.toMatch(pattern);
      }
    });

    it(`${file} imports from @/lib/dateFormatters`, () => {
      const source = readSource(file);
      expect(source).toMatch(/@\/lib\/dateFormatters/);
    });
  }
});
