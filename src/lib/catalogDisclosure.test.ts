import { describe, it, expect } from "vitest";
import {
  DISCLOSURE_FIELDS,
  missingDisclosures,
  summarizeDisclosures,
  countIncomplete,
} from "./catalogDisclosure";

const complet = {
  recognition_type: "attestation_formation",
  funding_terms: "OPCO, plan de développement des compétences",
  access_delay: "15 jours ouvrés avant le début de la session",
  accessibility_terms: "Contacter le référent handicap",
};

describe("missingDisclosures", () => {
  it("ne signale rien quand les quatre mentions sont renseignées", () => {
    expect(missingDisclosures(complet)).toEqual([]);
  });

  it("signale les quatre mentions sur une formation vide", () => {
    expect(missingDisclosures({})).toEqual([
      "Délai d'accès",
      "Modalités de financement",
      "Accessibilité",
      "Sanction de la formation",
    ]);
  });

  it("traite null et undefined comme non renseigné", () => {
    expect(missingDisclosures({ access_delay: null, funding_terms: undefined })).toContain(
      "Délai d'accès",
    );
    expect(missingDisclosures({ access_delay: null })).toContain("Modalités de financement");
  });

  // Une mention faite d'espaces ne porte aucune information : la compter
  // comme remplie afficherait « complet » sur une formation qui ne dit rien.
  it("ne compte pas une suite d'espaces comme une mention", () => {
    expect(missingDisclosures({ ...complet, access_delay: "   " })).toEqual(["Délai d'accès"]);
  });

  it("rend les libellés dans l'ordre d'affichage", () => {
    const labels = DISCLOSURE_FIELDS.map((f) => f.label);
    expect(missingDisclosures({})).toEqual(labels);
  });
});

describe("summarizeDisclosures", () => {
  it("compte les mentions renseignées", () => {
    const s = summarizeDisclosures({ access_delay: "15 jours", funding_terms: "OPCO" });
    expect(s.filled).toBe(2);
    expect(s.total).toBe(4);
    expect(s.complete).toBe(false);
    expect(s.missing).toEqual(["Accessibilité", "Sanction de la formation"]);
  });

  it("marque complet seulement quand rien ne manque", () => {
    expect(summarizeDisclosures(complet).complete).toBe(true);
    expect(summarizeDisclosures({ ...complet, recognition_type: "" }).complete).toBe(false);
  });
});

describe("countIncomplete", () => {
  it("compte les formations auxquelles il manque au moins une mention", () => {
    expect(countIncomplete([complet, {}, { access_delay: "15 jours" }])).toBe(2);
  });

  it("rend zéro sur un catalogue vide", () => {
    expect(countIncomplete([])).toBe(0);
  });
});
