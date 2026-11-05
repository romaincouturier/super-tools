import { describe, expect, it } from "vitest";
import { extractPictoSearchWord, isSafePictoText, isValidPictoWord } from "./pictodico-validation";

describe("pictodico-validation", () => {
  it("accepte les vrais mots", () => {
    for (const w of ["télé", "mot de passe", "S'amuser", "50 ans", "King-Charles"]) expect(isValidPictoWord(w)).toBe(true);
  });
  it("rejette injections, URL, signalements et mots trop longs", () => {
    for (const w of ["agriculture'rznjgg<'\">vvjlbs", "agriculture.((\").'.()", "(", "https://picto-dico.fr", "erreur signalée : doublon", "escape game → jeu d'évasion", "a".repeat(61)]) {
      expect(isValidPictoWord(w)).toBe(false);
    }
  });
  it("rejette les commentaires suspects", () => {
    expect(isSafePictoText("Doublon dans les résultats")).toBe(true);
    expect(isSafePictoText("doublon((\'.(\".)")).toBe(false);
    expect(isSafePictoText("x'\">y")).toBe(false);
  });
  it("n'extrait le mot que des URL picto-dico.fr", () => {
    expect(extractPictoSearchWord("https://picto-dico.fr/rechercher-un-picto/?_sf_s=d%C3%A9mocratie")).toBe("démocratie");
    expect(extractPictoSearchWord("https://evil.example/?_sf_s=vote")).toBeNull();
  });
});
