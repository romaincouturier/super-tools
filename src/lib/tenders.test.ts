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

describe("resolveDceLink", () => {
  it("garde un lien direct et décode les entités HTML", () => {
    const link = resolveDceLink({
      decision: {
        url_dce:
          "https://www.marches-publics.info/mpiaws/index.cfm?fuseaction=dematEnt.login&amp;type=DCE&amp;IDM=1832040",
      },
    });
    expect(link).toEqual({
      url: "https://www.marches-publics.info/mpiaws/index.cfm?fuseaction=dematEnt.login&type=DCE&IDM=1832040",
      direct: true,
      label: "Le DCE",
    });
  });

  it("transforme la racine PLACE en recherche sur la référence de consultation", () => {
    const link = resolveDceLink({
      decision: { url_dce: "https://www.marches-publics.gouv.fr/entreprise" },
      raw: {
        donnees: JSON.stringify({
          EFORMS: { ContractNotice: { "cac:ProcurementProject": { "cbc:ID": "DGAL-2025-074" } } },
        }),
      },
    });
    expect(link?.direct).toBe(false);
    expect(link?.url).toContain("keyWord=DGAL-2025-074");
  });

  it("rend la racine telle quelle quand aucune référence n'est publiée", () => {
    const link = resolveDceLink({ decision: { url_dce: "https://marches.departement13.fr" } });
    expect(link).toEqual({
      url: "https://marches.departement13.fr",
      direct: false,
      label: "Plateforme de retrait",
    });
  });

  it("rend null sans lien DCE", () => {
    expect(resolveDceLink({ decision: {} })).toBeNull();
  });
});
