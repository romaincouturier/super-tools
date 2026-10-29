import { describe, expect, it } from "vitest";
import { buildMicroDevisItems, followupAmount, totalHours } from "./micro-devis-followup.ts";

const coache = { name: "Formation en ligne à la Facilitation graphique — Coaché", unitPrice: 539, baseHours: 26.5, quantity: 1, adminFee: 0 };

describe("micro-devis suivi pédagogique", () => {
  it("montant ajouté = séances × tarif horaire", () => {
    expect(followupAmount({ addedSessions: 3, hourlyRate: 120, singleLine: true })).toBe(360);
  });

  it("durée = 26,5 h + 3 h", () => {
    expect(totalHours(26.5, { addedSessions: 3, hourlyRate: 120, singleLine: true })).toBe(29.5);
  });

  it("Coaché + 3 séances sur une seule ligne", () => {
    const items = buildMicroDevisItems({ ...coache, followup: { addedSessions: 3, hourlyRate: 120, singleLine: true } });
    expect(items).toHaveLength(1);
    expect(items[0].unit_price).toBe(899);
    expect(items[0].duration).toBe("29,5h");
    expect(items[0].name).toContain("dont 3 séances de suivi pédagogique individuel (3h)");
  });

  it("lignes séparées quand décoché", () => {
    const items = buildMicroDevisItems({ ...coache, adminFee: 150, followup: { addedSessions: 3, hourlyRate: 120, singleLine: false } });
    expect(items.map((i) => i.unit_price)).toEqual([689, 360]);
    expect(items.map((i) => i.duration)).toEqual(["26,5h", "3h"]);
  });

  it("jamais « coach » côté client", () => {
    const items = buildMicroDevisItems({ ...coache, followup: { addedSessions: 2, hourlyRate: 150, singleLine: false } });
    for (const i of items) expect(i.name.toLowerCase()).not.toContain("coach");
  });
});
