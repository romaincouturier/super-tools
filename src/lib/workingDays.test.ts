import { describe, it, expect } from "vitest";
import { subtractWorkingDays, addWorkingDays } from "./workingDays";

// Helper: create a date without timezone issues
const d = (dateStr: string) => new Date(`${dateStr}T12:00:00`);

// Default working days: Mon-Fri
const DEFAULT_WD = [false, true, true, true, true, true, false];

// ── subtractWorkingDays ──────────────────────────────────────────────

describe("subtractWorkingDays", () => {
  // ── Cas nominaux ───────────────────────────────────────────

  it("subtracts 1 working day on a Wednesday → Tuesday", () => {
    // 2026-02-25 is a Wednesday
    const result = subtractWorkingDays(d("2026-02-25"), 1);
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getDate()).toBe(24);
  });

  it("subtracts 5 working days → exactly one calendar week back", () => {
    // Wednesday Feb 25 - 5 working days = Wednesday Feb 18
    const result = subtractWorkingDays(d("2026-02-25"), 5);
    expect(result.getDate()).toBe(18);
    expect(result.getMonth()).toBe(1); // Feb
  });

  it("skips weekends when subtracting", () => {
    // Monday Feb 23 - 1 working day = Friday Feb 20
    const result = subtractWorkingDays(d("2026-02-23"), 1);
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(20);
  });

  it("subtracts across month boundary", () => {
    // Tuesday Mar 3 2026 - 3 working days = Thursday Feb 26
    const result = subtractWorkingDays(d("2026-03-03"), 3);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(26);
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("subtracting 0 days returns the same date", () => {
    const original = d("2026-02-25");
    const result = subtractWorkingDays(original, 0);
    expect(result.getDate()).toBe(25);
    expect(result.getMonth()).toBe(1);
  });

  it("works with custom working days (Mon-Sat)", () => {
    const monToSat = [false, true, true, true, true, true, true];
    // Sunday Mar 1 - 1 working day with Mon-Sat = Saturday Feb 28
    const result = subtractWorkingDays(d("2026-03-01"), 1, monToSat);
    expect(result.getDay()).toBe(6); // Saturday
    expect(result.getDate()).toBe(28);
  });

  it("works with only 1 working day per week", () => {
    // Only Wednesdays are working days
    const onlyWed = [false, false, false, true, false, false, false];
    // Wednesday Feb 25 - 2 working days = Wed Feb 11
    const result = subtractWorkingDays(d("2026-02-25"), 2, onlyWed);
    expect(result.getDay()).toBe(3); // Wednesday
    expect(result.getDate()).toBe(11);
  });

  it("does not mutate the input date", () => {
    const original = d("2026-02-25");
    const originalTime = original.getTime();
    subtractWorkingDays(original, 3);
    expect(original.getTime()).toBe(originalTime);
  });

  // ── From a weekend start ───────────────────────────────────

  it("starting from Saturday, subtracting 1 → Friday", () => {
    // Saturday Feb 21 - 1 working day = Friday Feb 20
    const result = subtractWorkingDays(d("2026-02-21"), 1);
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(20);
  });

  it("starting from Sunday, subtracting 1 → Friday", () => {
    // Sunday Feb 22 - 1 working day = Friday Feb 20
    const result = subtractWorkingDays(d("2026-02-22"), 1);
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(20);
  });
});

// ── addWorkingDays ───────────────────────────────────────────────────

describe("addWorkingDays", () => {
  // ── Cas nominaux ───────────────────────────────────────────

  it("adds 1 working day on a Wednesday → Thursday", () => {
    const result = addWorkingDays(d("2026-02-25"), 1);
    expect(result.getDay()).toBe(4); // Thursday
    expect(result.getDate()).toBe(26);
  });

  it("adds 5 working days → exactly one calendar week forward", () => {
    // Wednesday Feb 25 + 5 working days = Wednesday Mar 4
    const result = addWorkingDays(d("2026-02-25"), 5);
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(2); // March
  });

  it("skips weekends when adding", () => {
    // Friday Feb 27 + 1 working day = Monday Mar 2
    const result = addWorkingDays(d("2026-02-27"), 1);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(2);
  });

  it("adds across month boundary", () => {
    // Thursday Feb 26 + 3 working days = Wednesday Mar 3 (skips weekend)
    const result = addWorkingDays(d("2026-02-26"), 3);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(3);
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("adding 0 days returns the same date", () => {
    const result = addWorkingDays(d("2026-02-25"), 0);
    expect(result.getDate()).toBe(25);
  });

  it("works with custom working days (Mon-Sat)", () => {
    const monToSat = [false, true, true, true, true, true, true];
    // Friday Feb 27 + 1 = Saturday Feb 28 (Saturday is working)
    const result = addWorkingDays(d("2026-02-27"), 1, monToSat);
    expect(result.getDay()).toBe(6); // Saturday
    expect(result.getDate()).toBe(28);
  });

  it("does not mutate the input date", () => {
    const original = d("2026-02-25");
    const originalTime = original.getTime();
    addWorkingDays(original, 3);
    expect(original.getTime()).toBe(originalTime);
  });

  // ── From a weekend start ───────────────────────────────────

  it("starting from Saturday, adding 1 → Monday", () => {
    // Saturday Feb 21 + 1 working day = Monday Feb 23
    const result = addWorkingDays(d("2026-02-21"), 1);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(23);
  });

  it("starting from Sunday, adding 1 → Monday", () => {
    // Sunday Feb 22 + 1 working day = Monday Feb 23
    const result = addWorkingDays(d("2026-02-22"), 1);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(23);
  });

  // ── Symmetry ───────────────────────────────────────────────

  it("add then subtract returns to original date", () => {
    const original = d("2026-02-25");
    const forward = addWorkingDays(original, 7);
    const back = subtractWorkingDays(forward, 7);
    expect(back.getDate()).toBe(original.getDate());
    expect(back.getMonth()).toBe(original.getMonth());
  });

  it("subtract then add returns to original date", () => {
    const original = d("2026-02-25");
    const back = subtractWorkingDays(original, 10);
    const forward = addWorkingDays(back, 10);
    expect(forward.getDate()).toBe(original.getDate());
    expect(forward.getMonth()).toBe(original.getMonth());
  });
});
