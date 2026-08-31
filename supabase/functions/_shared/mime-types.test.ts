import { describe, it, expect } from "vitest";
import { mimeTypeFromFileName, guessMimeType } from "./mime-types.ts";

describe("mimeTypeFromFileName", () => {
  it("reconnaît les vidéos sauvegardées depuis le storage", () => {
    expect(mimeTypeFromFileName("img_7571.mov")).toBe("video/quicktime");
    expect(mimeTypeFromFileName("session.mp4")).toBe("video/mp4");
  });

  it("ignore la casse de l'extension", () => {
    expect(mimeTypeFromFileName("Rapport.PDF")).toBe("application/pdf");
  });

  it("gère un chemin complet avec des points dans le nom", () => {
    expect(mimeTypeFromFileName("mission/2026.04.27_bilan.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("retombe sur octet-stream pour une extension inconnue", () => {
    expect(mimeTypeFromFileName("archive.xyz")).toBe("application/octet-stream");
  });

  it("retombe sur octet-stream pour un nom sans extension", () => {
    expect(mimeTypeFromFileName("LICENSE")).toBe("application/octet-stream");
  });

  it("accepte un fallback explicite", () => {
    expect(mimeTypeFromFileName("archive.xyz", "text/plain")).toBe("text/plain");
  });
});

describe("guessMimeType", () => {
  it("résout les extensions connues comme mimeTypeFromFileName", () => {
    expect(guessMimeType("facture.csv")).toBe("text/csv");
  });

  it("retombe sur PDF, le format habituel des pièces jointes CRM", () => {
    expect(guessMimeType("piece-jointe-sans-extension")).toBe("application/pdf");
  });
});
