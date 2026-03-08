/**
 * Integration tests for dateFormatters & trainingFormatters.
 *
 * These tests are distinct from the unit tests (dateFormatters.test.ts):
 * - Section 1: Supabase timestamptz handling (TZ-sensitive, requires TZ=UTC)
 * - Section 2: Component composition patterns (multi-formatter combos)
 * - Section 3: Static analysis — migrated files use shared imports, no inline
 * - Section 4: trainingFormatters migration status
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  formatDateWithTime,
  formatDateTimeSeconds,
  formatSentDateTime,
  formatDateTimeShort,
  formatDateSlot,
  getPeriodLabel,
} from "./dateFormatters";

// ── Helper ──────────────────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, "../..", relativePath), "utf-8");
}

// ── 1. Supabase timestamptz handling (TZ=UTC deterministic) ────────────────
// Unit tests cover date-only (YYYY-MM-DD) and local timestamps.
// Here we test specifically how timezone-aware strings from Supabase are parsed.

describe("Supabase timestamptz → local time conversion (TZ=UTC)", () => {
  it("formatDateWithTime: +00:00 offset renders UTC time", () => {
    expect(formatDateWithTime("2026-03-15T14:30:00+00:00")).toBe("15 mars 2026 à 14:30");
  });

  it("formatDateWithTime: Z suffix renders same as +00:00", () => {
    expect(formatDateWithTime("2026-03-15T14:30:00Z")).toBe("15 mars 2026 à 14:30");
  });

  it("formatDateWithTime: +01:00 offset shifts to UTC (14:30+01 → 13:30 UTC)", () => {
    expect(formatDateWithTime("2026-03-15T14:30:00+01:00")).toBe("15 mars 2026 à 13:30");
  });

  it("formatDateWithTime: -05:00 offset shifts to UTC (10:00-05 → 15:00 UTC)", () => {
    expect(formatDateWithTime("2026-03-15T10:00:00-05:00")).toBe("15 mars 2026 à 15:00");
  });

  it("formatDateTimeSeconds: +00:00 preserves seconds", () => {
    expect(formatDateTimeSeconds("2026-03-15T14:30:45+00:00")).toBe("15 mars 2026 à 14:30:45");
  });

  it("formatSentDateTime: +00:00 compact form", () => {
    expect(formatSentDateTime("2026-03-15T14:30:00+00:00")).toBe("15 mars à 14:30");
  });

  it("formatDateTimeShort: +00:00 short form", () => {
    expect(formatDateTimeShort("2026-03-15T14:30:00+00:00")).toBe("15 mars 2026 14:30");
  });

  it("date rolls over when offset crosses midnight", () => {
    // 2026-03-15T01:00:00+03:00 → 2026-03-14T22:00:00 UTC
    expect(formatDateWithTime("2026-03-15T01:00:00+03:00")).toBe("14 mars 2026 à 22:00");
  });
});

// ── 2. Component composition patterns ───────────────────────────────────────
// Tests that verify real multi-formatter patterns used inside components.

describe("Component composition patterns", () => {
  describe("AttendanceSignatureBlock – slot label (formatDateSlot + getPeriodLabel)", () => {
    it("morning slot", () => {
      expect(`${formatDateSlot("2026-03-15")} ${getPeriodLabel("AM")}`).toBe("15/03 Matin");
    });

    it("afternoon slot", () => {
      expect(`${formatDateSlot("2026-03-15")} ${getPeriodLabel("PM")}`).toBe("15/03 Après-midi");
    });
  });

  describe("DocumentsManager – sent date + full tooltip", () => {
    it("compact sent display", () => {
      expect(formatSentDateTime("2026-03-15T09:45:00")).toBe("15 mars à 09:45");
    });

    it("full tooltip with seconds", () => {
      expect(formatDateTimeSeconds("2026-03-15T09:45:32")).toBe("15 mars 2026 à 09:45:32");
    });
  });
});

// ── 3. Static analysis — no inline date formatting in migrated files ────────

describe("No inline date formatting in migrated files", () => {
  // Fully migrated: all date formatting uses shared imports, zero inline.
  const fullyMigrated = [
    "src/pages/Formations.tsx",
    "src/pages/Evaluation.tsx",
    "src/pages/SponsorEvaluation.tsx",
    "src/pages/Emargement.tsx",
    "src/pages/EventDetail.tsx",
    "src/pages/Questionnaire.tsx",
  ];

  // Partially migrated: use shared imports for main formatting but retain
  // justified inline format() calls for contextual needs.
  const partiallyMigrated = [
    {
      file: "src/pages/Events.tsx",
      reason: "Uses inline format(parseISO, 'MMM') for calendar date-block UI (no shared formatter for month-only)",
    },
    {
      file: "src/pages/TrainingSummary.tsx",
      reason: "Uses inline format(parseISO, 'd MMM') in calendar URL construction (ICS, Google, Outlook, Yahoo)",
    },
    {
      file: "src/components/formations/DocumentsManager.tsx",
      reason: "Uses inline format(parseISO, 'HH:mm:ss') for signature journey event timestamps (time-only)",
    },
  ];

  // Inline function definitions (should have been replaced by imports)
  const inlineFunctionPatterns = [
    /const formatDateFr\s*=/,
    /const formatDateLong\s*=/,
    /const formatFullDate\s*=\s*\(/,
    /const formatSentDate\s*=\s*\(/,
    /const formatDateRange\s*=\s*\(/,
    /const getPeriodLabel\s*=\s*\(\s*period/,
    /const formatDate\s*=\s*\(\s*dateStr/,
  ];

  // Inline format() calls with fr locale (should use shared formatters)
  const inlineFormatCallPatterns = [
    /format\s*\(\s*parseISO\s*\([^)]+\)\s*,\s*"[^"]+"\s*,\s*\{\s*locale:\s*fr\s*\}/,
    /format\s*\(\s*new Date\s*\([^)]*\)\s*,\s*"[^"]+"\s*,\s*\{\s*locale:\s*fr\s*\}/,
  ];

  // Native JS date formatting (should use date-fns shared formatters)
  const nativeDatePatterns = [
    /\.toLocaleDateString\s*\(\s*["']fr/,
    /new Intl\.DateTimeFormat\s*\(\s*["']fr/,
    /\.toLocaleString\s*\(\s*["']fr/,
  ];

  // ── Fully migrated files: all 4 checks ──

  for (const file of fullyMigrated) {
    it(`${file} imports from @/lib/dateFormatters`, () => {
      const source = readSource(file);
      expect(source).toMatch(/@\/lib\/dateFormatters/);
    });

    it(`${file} has no inline date formatter definitions`, () => {
      const source = readSource(file);
      for (const pattern of inlineFunctionPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });

    it(`${file} has no inline format(parseISO(...), ..., { locale: fr }) calls`, () => {
      const source = readSource(file);
      for (const pattern of inlineFormatCallPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });

    it(`${file} has no native toLocaleDateString/Intl.DateTimeFormat fr calls`, () => {
      const source = readSource(file);
      for (const pattern of nativeDatePatterns) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  // ── Partially migrated files: check imports + definitions + native, skip inline format calls ──

  for (const { file, reason } of partiallyMigrated) {
    it(`${file} imports from @/lib/dateFormatters`, () => {
      const source = readSource(file);
      expect(source).toMatch(/@\/lib\/dateFormatters/);
    });

    it(`${file} has no inline date formatter definitions`, () => {
      const source = readSource(file);
      for (const pattern of inlineFunctionPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });

    it(`${file} has no native toLocaleDateString/Intl.DateTimeFormat fr calls`, () => {
      const source = readSource(file);
      for (const pattern of nativeDatePatterns) {
        expect(source).not.toMatch(pattern);
      }
    });

    // Document the known remaining inline calls
    it(`${file} has known inline format() calls (${reason})`, () => {
      const source = readSource(file);
      const hasInlineFormat = inlineFormatCallPatterns.some((p) => p.test(source));
      expect(hasInlineFormat).toBe(true);
    });
  }
});

// ── 4. trainingFormatters migration status ──────────────────────────────────
// These inline functions live in useFormationDetail.ts (the hook),
// NOT in FormationDetail.tsx (the page component — already split).

describe("trainingFormatters migration status", () => {
  const hookFile = "src/hooks/useFormationDetail.ts";

  it("useFormationDetail.ts still has inline calculateTotalDuration (not yet migrated)", () => {
    const source = readSource(hookFile);
    expect(source).toMatch(/const calculateTotalDuration\s*=/);
  });

  it("useFormationDetail.ts still has inline getFormatLabel (not yet migrated)", () => {
    const source = readSource(hookFile);
    expect(source).toMatch(/const getFormatLabel\s*=/);
  });

  it("useFormationDetail.ts still has inline getSponsorName (not yet migrated)", () => {
    const source = readSource(hookFile);
    expect(source).toMatch(/const getSponsorName\s*=/);
  });

  it("useFormationDetail.ts still has inline formatDateWithSchedule (not yet migrated)", () => {
    const source = readSource(hookFile);
    expect(source).toMatch(/const formatDateWithSchedule\s*=/);
  });
});
