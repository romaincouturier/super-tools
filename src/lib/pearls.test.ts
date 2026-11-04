import { describe, expect, it } from "vitest";
import { formatPearlDate } from "./pearls";
import { pearlAuthorLabel } from "@/services/pearls";

describe("formatPearlDate", () => {
  it("affiche la date en français sans heure", () => {
    expect(formatPearlDate("2026-11-04")).toBe("4 novembre 2026");
  });

  it("ajoute l'heure tronquée à HH:MM quand elle est connue", () => {
    expect(formatPearlDate("2026-11-04", "08:34:23")).toBe("4 novembre 2026 à 08:34");
  });

  it("ignore une heure nulle", () => {
    expect(formatPearlDate("2026-02-03", null)).toBe("3 février 2026");
  });
});

describe("pearlAuthorLabel", () => {
  it("ne révèle jamais l'auteur d'une perle anonyme", () => {
    expect(pearlAuthorLabel({ is_anonymous: true, author_name: "Tobias", author_company: "Arturia" })).toBe("Anonyme");
  });

  it("assemble nom et entreprise", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: "Tobias", author_company: "Arturia" })).toBe("Tobias, Arturia");
  });

  it("n'affiche que le champ renseigné", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: "Odile", author_company: null })).toBe("Odile");
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: null, author_company: "EDHEC" })).toBe("EDHEC");
  });

  it("retombe sur Anonyme sans nom ni entreprise", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: null, author_company: null })).toBe("Anonyme");
  });
});
