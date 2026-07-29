import { describe, it, expect } from "vitest";
import { daysBetween, previousPeriod, defaultPeriod } from "./seo-tools.ts";
import { normalizeUrl } from "./gsc.ts";

describe("daysBetween", () => {
  it("compte les bornes incluses", () => {
    expect(daysBetween("2026-07-01", "2026-07-01")).toBe(1);
    expect(daysBetween("2026-07-01", "2026-07-28")).toBe(28);
  });

  it("traverse un changement de mois et une fin d'année", () => {
    expect(daysBetween("2026-01-30", "2026-02-02")).toBe(4);
    expect(daysBetween("2025-12-30", "2026-01-02")).toBe(4);
  });
});

describe("previousPeriod", () => {
  it("renvoie la période de même longueur qui précède immédiatement", () => {
    expect(previousPeriod({ from: "2026-07-01", to: "2026-07-28" }))
      .toEqual({ from: "2026-06-03", to: "2026-06-30" });
  });

  it("ne laisse aucun jour de recouvrement ni de trou", () => {
    const period = { from: "2026-03-15", to: "2026-04-14" };
    const previous = previousPeriod(period);
    expect(daysBetween(previous.from, previous.to)).toBe(daysBetween(period.from, period.to));
    expect(daysBetween(previous.to, period.from)).toBe(2); // jours consécutifs
  });
});

describe("defaultPeriod", () => {
  it("s'arrête au décalage de publication de Search Console", () => {
    const period = defaultPeriod(28, 2);
    expect(daysBetween(period.from, period.to)).toBe(28);
    const expectedEnd = new Date();
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 2);
    expect(period.to).toBe(expectedEnd.toISOString().slice(0, 10));
  });
});

describe("normalizeUrl", () => {
  it("rapproche les URL Search Console des URL WordPress", () => {
    const expected = "supertilt.fr/6-pictos-essentiels";
    expect(normalizeUrl("https://www.supertilt.fr/6-pictos-essentiels/")).toBe(expected);
    expect(normalizeUrl("http://supertilt.fr/6-pictos-essentiels")).toBe(expected);
    expect(normalizeUrl("https://www.supertilt.fr/6-Pictos-Essentiels/")).toBe(expected);
  });

  it("ignore les paramètres de campagne", () => {
    expect(normalizeUrl("https://supertilt.fr/article?utm_source=newsletter"))
      .toBe("supertilt.fr/article");
  });

  it("tolère une valeur vide ou non parsable", () => {
    expect(normalizeUrl(null)).toBe("");
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("www.supertilt.fr/article/")).toBe("supertilt.fr/article");
  });
});
