import { describe, expect, it } from "vitest";
import { isTenderSourceStale, workingDaysSince } from "./tender-health.ts";

describe("santé veille AO", () => {
  it("n'alerte pas à trois jours ouvrés", () => {
    expect(isTenderSourceStale("2026-11-12T10:00:00Z", new Date("2026-11-17T06:43:00Z"))).toBe(false);
  });
  it("alerte au quatrième jour ouvré", () => {
    expect(isTenderSourceStale("2026-11-11T10:00:00Z", new Date("2026-11-17T06:43:00Z"))).toBe(true);
  });
  it("ignore samedi et dimanche", () => {
    expect(workingDaysSince("2026-11-13T10:00:00Z", new Date("2026-11-16T06:00:00Z"))).toBe(1);
  });
  it("compare les dates à Paris", () => {
    expect(workingDaysSince("2026-11-15T23:30:00Z", new Date("2026-11-17T06:00:00Z"))).toBe(1);
  });
  it("signale une source sans aucun import", () => {
    expect(isTenderSourceStale(null)).toBe(true);
  });
});