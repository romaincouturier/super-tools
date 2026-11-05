import { describe, it, expect } from "vitest";
import {
  HANDICAP_TYPES,
  handicapTypeLabel,
  uncoveredTypes,
  activeCount,
} from "./handicapPartners";

describe("handicapTypeLabel", () => {
  it("rend le libellé de chaque type", () => {
    expect(handicapTypeLabel("auditif")).toBe("Déficiences auditives");
    expect(handicapTypeLabel("tous")).toBe("Tous handicaps");
  });

  it("rend un tiret pour une valeur inconnue ou absente", () => {
    expect(handicapTypeLabel("inconnu")).toBe("—");
    expect(handicapTypeLabel(null)).toBe("—");
    expect(handicapTypeLabel(undefined)).toBe("—");
  });
});

describe("uncoveredTypes", () => {
  // Un partenaire généraliste suffit : réclamer un spécialiste par déficience
  // alors qu'un acteur couvre tout afficherait un manque qui n'existe pas.
  it("ne signale rien quand un partenaire couvre tous les handicaps", () => {
    expect(uncoveredTypes([{ handicap_type: "tous" }])).toEqual([]);
  });

  it("signale les types qu'aucun partenaire ne couvre", () => {
    const manquants = uncoveredTypes([{ handicap_type: "auditif" }, { handicap_type: "visuel" }]);
    expect(manquants).toContain("Déficiences motrices");
    expect(manquants).toContain("Troubles psychiques");
    expect(manquants).not.toContain("Déficiences auditives");
  });

  it("ne réclame ni « Tous handicaps » ni « Autre » comme couverture manquante", () => {
    const manquants = uncoveredTypes([]);
    expect(manquants).not.toContain("Tous handicaps");
    expect(manquants).not.toContain("Autre");
    expect(manquants).toHaveLength(HANDICAP_TYPES.length - 2);
  });

  // Un partenaire désactivé ne couvre plus rien : le compter laisserait croire
  // à une couverture que personne n'assure.
  it("ignore les partenaires désactivés", () => {
    expect(uncoveredTypes([{ handicap_type: "tous", is_active: false }])).not.toEqual([]);
    expect(uncoveredTypes([{ handicap_type: "auditif", is_active: false }])).toContain(
      "Déficiences auditives",
    );
  });

  it("traite un is_active absent comme actif", () => {
    expect(uncoveredTypes([{ handicap_type: "tous", is_active: null }])).toEqual([]);
    expect(uncoveredTypes([{ handicap_type: "tous" }])).toEqual([]);
  });
});

describe("activeCount", () => {
  it("compte les partenaires actifs", () => {
    expect(
      activeCount([
        { handicap_type: "tous" },
        { handicap_type: "auditif", is_active: true },
        { handicap_type: "visuel", is_active: false },
      ]),
    ).toBe(2);
  });

  it("rend zéro sur une liste vide", () => {
    expect(activeCount([])).toBe(0);
  });
});
