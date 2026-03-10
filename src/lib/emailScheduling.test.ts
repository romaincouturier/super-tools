import { describe, it, expect, vi, afterEach } from "vitest";
import { getEmailMode, isManualEmailMode } from "./emailScheduling";

// Mock date-fns to control "today"
// Use midnight to avoid differenceInDays truncation issues
const MOCK_TODAY = new Date("2026-03-10T00:00:00Z");

describe("getEmailMode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function withFakeDate(fn: () => void) {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
    fn();
  }

  it("returns programme + no send when startDate is null", () => {
    const result = getEmailMode(null);
    expect(result).toEqual({ status: "programme", sendWelcomeNow: false });
  });

  it("returns programme + no send when startDate is undefined", () => {
    const result = getEmailMode(undefined);
    expect(result).toEqual({ status: "programme", sendWelcomeNow: false });
  });

  it("returns non_envoye when training already started (past date)", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-09");
      expect(result).toEqual({ status: "non_envoye", sendWelcomeNow: false });
    });
  });

  it("returns non_envoye when training starts today (0 days)", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-10");
      expect(result).toEqual({ status: "non_envoye", sendWelcomeNow: false });
    });
  });

  it("returns manuel when training is 1 day away (< 2 days)", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-11");
      expect(result).toEqual({ status: "manuel", sendWelcomeNow: false });
    });
  });

  it("returns accueil_envoye + send now when training is 2 days away", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-12");
      expect(result).toEqual({ status: "accueil_envoye", sendWelcomeNow: true });
    });
  });

  it("returns accueil_envoye + send now when training is 7 days away", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-17");
      expect(result).toEqual({ status: "accueil_envoye", sendWelcomeNow: true });
    });
  });

  it("returns programme + no send when training is 8+ days away", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-03-18");
      expect(result).toEqual({ status: "programme", sendWelcomeNow: false });
    });
  });

  it("returns programme + no send when training is far in the future", () => {
    withFakeDate(() => {
      const result = getEmailMode("2026-06-15");
      expect(result).toEqual({ status: "programme", sendWelcomeNow: false });
    });
  });
});

describe("isManualEmailMode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for manuel status (1 day away)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
    expect(isManualEmailMode("2026-03-11")).toBe(true);
  });

  it("returns true for non_envoye status (past date)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
    expect(isManualEmailMode("2026-03-09")).toBe(true);
  });

  it("returns false for programme status (null)", () => {
    expect(isManualEmailMode(null)).toBe(false);
  });

  it("returns false for accueil_envoye status (5 days away)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
    expect(isManualEmailMode("2026-03-15")).toBe(false);
  });
});
