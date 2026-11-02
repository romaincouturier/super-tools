import { describe, expect, it } from "vitest";
import { phrasesToText } from "./loom.ts";

describe("phrasesToText", () => {
  it("préfixe chaque ligne du locuteur quand Loom le fournit", () => {
    expect(phrasesToText([
      { ts: 0, speakerName: "Romain", value: "Bonjour" },
      { ts: 3.2, speakerName: "Romain", value: "on démarre" },
    ])).toBe("Romain: Bonjour\nRomain: on démarre");
  });

  it("garde le texte nu sans locuteur", () => {
    expect(phrasesToText([{ ts: 0, value: "Bonjour" }])).toBe("Bonjour");
  });

  it("ignore les phrases vides et nettoie les espaces", () => {
    expect(phrasesToText([
      { ts: 0, speakerName: " ", value: "  Bonjour  " },
      { ts: 1, speakerName: "Romain", value: "   " },
      { ts: 2, value: "fin" },
    ])).toBe("Bonjour\nfin");
  });

  it("rend une chaîne vide pour un transcript sans phrase", () => {
    expect(phrasesToText([])).toBe("");
  });
});
