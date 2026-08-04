import { describe, expect, it } from "vitest";
import {
  buildDocumentPrompt,
  buildNoticePrompt,
  MAX_PROMPT_CHARS,
  parseAiJson,
} from "./tender-ai.ts";

describe("buildNoticePrompt", () => {
  it("reprend les champs structurés avant la prose", () => {
    const prompt = buildNoticePrompt({
      objet: "Accord-cadre de facilitation graphique",
      acheteur: "Communauté urbaine de Dunkerque",
      datelimitereponse: "2026-09-15",
      cpv_codes: ["79822500"],
      decision: { criteres: [{ libelle: "Prix", poids: "40 %" }] },
      fullText: "Le présent marché porte sur des ateliers.",
    });
    expect(prompt).toContain("Objet : Accord-cadre de facilitation graphique");
    expect(prompt).toContain("Communauté urbaine de Dunkerque");
    expect(prompt).toContain('"libelle": "Prix"');
    expect(prompt.indexOf("Éléments extraits")).toBeLessThan(prompt.indexOf("Texte de l'avis"));
  });

  it("reste lisible quand tout manque", () => {
    const prompt = buildNoticePrompt({});
    expect(prompt).toContain("(non renseigné)");
    expect(prompt).not.toContain("Texte de l'avis");
  });

  // Un avis BOAMP complet dépasse largement la fenêtre utile : tronquer est
  // volontaire, mais doit se voir dans le prompt pour que le modèle ne conclue
  // pas sur un document qu'il croit entier.
  it("tronque un avis trop long en le signalant", () => {
    const prompt = buildNoticePrompt({ objet: "x", fullText: "a".repeat(MAX_PROMPT_CHARS + 5_000) });
    expect(prompt).toContain("document tronqué");
    expect(prompt.length).toBeLessThan(MAX_PROMPT_CHARS + 1_000);
  });
});

describe("buildDocumentPrompt", () => {
  it("nomme le fichier et rappelle le marché", () => {
    const prompt = buildDocumentPrompt({
      fileName: "CCTP.pdf",
      objet: "Ateliers d'intelligence collective",
      acheteur: "Région Grand Est",
      text: "Article 1 : objet du marché.",
      note: "Texte extrait de CCTP.pdf.",
    });
    expect(prompt).toContain("Document : CCTP.pdf");
    expect(prompt).toContain("Extraction : Texte extrait de CCTP.pdf.");
    expect(prompt).toContain("Article 1");
  });
});

describe("parseAiJson", () => {
  it("lit un JSON nu", () => {
    expect(parseAiJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("retire la clôture markdown que le modèle ajoute malgré la consigne", () => {
    expect(parseAiJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAiJson<{ a: number }>('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("récupère l'objet quand une phrase le précède", () => {
    expect(parseAiJson<{ a: number }>('Voici le résultat :\n{"a":1}')).toEqual({ a: 1 });
  });

  // Mieux vaut une erreur lisible stockée qu'une synthèse vide qui passerait
  // pour un résultat valide.
  it("lève un message lisible sur une réponse hors format", () => {
    expect(() => parseAiJson("désolé, je ne peux pas")).toThrow(/illisible/);
  });
});
