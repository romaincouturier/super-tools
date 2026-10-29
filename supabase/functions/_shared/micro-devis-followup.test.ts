import { describe, expect, it } from "vitest";
import { buildMicroDevisItems, followupAmount, totalHours, totalFollowupSessions } from "./micro-devis-followup.ts";

const coache = { name: "Formation en ligne à la Facilitation graphique — Coaché", unitPrice: 539, baseHours: 26.5, quantity: 1, adminFee: 0 };

describe("micro-devis suivi pédagogique", () => {
  it("2 séances incluses + 2 ajoutées = 4 heures de suivi, sans recompter ni refacturer les heures incluses", () => {
    const followup = { addedSessions: 2, hourlyRate: 150, singleLine: true };
    expect(totalFollowupSessions(2, followup)).toBe(4);
    const items = buildMicroDevisItems({ ...coache, includedSessions: 2, followup });
    expect(items[0].duration).toBe("28,5h");
    expect(items[0].unit_price).toBe(839);
  });

  it("les séances incluses restent comptées sans ajout", () => {
    expect(totalFollowupSessions(2)).toBe(2);
    const items = buildMicroDevisItems({ ...coache, includedSessions: 2 });
    expect(items[0].duration).toBe("26,5h");
    expect(items[0].unit_price).toBe(539);
  });

  it("les séances ajoutées sont facturées pour chaque participant", () => {
    const items = buildMicroDevisItems({ ...coache, quantity: 2, includedSessions: 2, followup: { addedSessions: 2, hourlyRate: 150, singleLine: true } });
    expect(items[0].quantity * items[0].unit_price).toBe(1678);
    expect(items[0].duration).toBe("28,5h");
  });

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
