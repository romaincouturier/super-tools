import { describe, it, expect } from "vitest";
import { normalizeLearnerEmail, isUsableLearnerEmail } from "./learner-email.ts";

describe("normalizeLearnerEmail", () => {
  it("met en minuscules", () => {
    expect(normalizeLearnerEmail("Alice@EXEMPLE.FR")).toBe("alice@exemple.fr");
  });

  it("retire les espaces de bord, y compris ceux collés par un copier-coller", () => {
    expect(normalizeLearnerEmail("  alice@exemple.fr \n")).toBe("alice@exemple.fr");
  });

  it("rend une chaîne vide pour une valeur absente", () => {
    expect(normalizeLearnerEmail(null)).toBe("");
    expect(normalizeLearnerEmail(undefined)).toBe("");
  });
});

describe("isUsableLearnerEmail", () => {
  it("accepte une adresse ordinaire", () => {
    expect(isUsableLearnerEmail(" Alice@Exemple.fr ")).toBe(true);
  });

  it("refuse une adresse absente ou sans arobase", () => {
    expect(isUsableLearnerEmail("")).toBe(false);
    expect(isUsableLearnerEmail(null)).toBe(false);
    expect(isUsableLearnerEmail("alice")).toBe(false);
  });

  it("refuse une adresse tronquée", () => {
    expect(isUsableLearnerEmail("@exemple.fr")).toBe(false);
    expect(isUsableLearnerEmail("alice@")).toBe(false);
  });
});
