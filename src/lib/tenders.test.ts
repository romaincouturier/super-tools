import { describe, expect, it } from "vitest";
import { daysLeft, isTenderUrgent } from "./tenders";

const NOW = new Date("2026-08-03T12:00:00Z");

describe("daysLeft", () => {
  it("compte les jours restants", () => {
    expect(daysLeft("2026-08-13T12:00:00Z", NOW)).toBe(10);
  });

  it("rend un nombre négatif sur une date dépassée", () => {
    expect(daysLeft("2026-07-30T12:00:00Z", NOW)).toBe(-4);
  });

  it("rend null quand la date limite n'est pas publiée", () => {
    // Cas fréquent au BOAMP : l'avis reste à traiter, mais ne peut pas être priorisé.
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft(undefined, NOW)).toBeNull();
    expect(daysLeft("bientôt", NOW)).toBeNull();
  });
});

describe("isTenderUrgent", () => {
  it("signale les échéances proches, jamais les dates inconnues ou passées", () => {
    expect(isTenderUrgent("2026-08-10T12:00:00Z", NOW)).toBe(true);
    expect(isTenderUrgent("2026-09-30T12:00:00Z", NOW)).toBe(false);
    expect(isTenderUrgent("2026-07-01T12:00:00Z", NOW)).toBe(false);
    expect(isTenderUrgent(null, NOW)).toBe(false);
  });
});
