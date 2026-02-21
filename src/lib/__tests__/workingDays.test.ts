import { describe, it, expect } from "vitest";
import { subtractWorkingDays, addWorkingDays } from "../workingDays";

// Monday 2025-01-06
const monday = new Date(2025, 0, 6);
// Default working days: Mon-Fri
const defaultWorkingDays = [false, true, true, true, true, true, false];

describe("subtractWorkingDays", () => {
  it("subtracts 1 working day from Monday -> previous Friday", () => {
    const result = subtractWorkingDays(monday, 1);
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(3); // Jan 3
  });

  it("subtracts 5 working days (full week)", () => {
    const result = subtractWorkingDays(monday, 5);
    // 5 working days back from Monday Jan 6 -> Monday Dec 30
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(30);
    expect(result.getMonth()).toBe(11); // December
  });

  it("subtracts 0 working days returns same date", () => {
    const result = subtractWorkingDays(monday, 0);
    expect(result.getTime()).toBe(monday.getTime());
  });

  it("respects custom working days (Mon-Sat)", () => {
    const monToSat = [false, true, true, true, true, true, true];
    // Friday Jan 10
    const friday = new Date(2025, 0, 10);
    const result = subtractWorkingDays(friday, 1, monToSat);
    // Should be Thursday (Saturday is now a working day but we go backwards)
    expect(result.getDay()).toBe(4); // Thursday
  });
});

describe("addWorkingDays", () => {
  it("adds 1 working day from Friday -> next Monday", () => {
    const friday = new Date(2025, 0, 3);
    const result = addWorkingDays(friday, 1);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(6); // Jan 6
  });

  it("adds 5 working days (full week)", () => {
    const result = addWorkingDays(monday, 5);
    // 5 working days from Monday Jan 6 -> Monday Jan 13
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(13);
  });

  it("adds 0 working days returns same date", () => {
    const result = addWorkingDays(monday, 0);
    expect(result.getTime()).toBe(monday.getTime());
  });

  it("skips weekends", () => {
    // Thursday Jan 9
    const thursday = new Date(2025, 0, 9);
    const result = addWorkingDays(thursday, 2);
    // Thu + 1 = Fri, Fri + skip Sat/Sun + 1 = Mon
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(13);
  });
});
