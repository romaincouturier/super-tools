import { describe, it, expect } from "vitest";
import { buildDisclosureText, periodLabel } from "./satisfactionDisclosure";

describe("periodLabel", () => {
  it("nomme l'année pour une période annuelle", () => {
    expect(periodLabel("2026")).toBe("sessions 2026");
  });

  it("borne le cumul aux années réellement couvertes", () => {
    expect(periodLabel("all", ["2026", "2024", "2025"])).toBe("sessions 2024 à 2026");
  });

  it("ne parle pas d'intervalle quand une seule année est couverte", () => {
    expect(periodLabel("all", ["2026"])).toBe("sessions 2026");
  });

  it("reste vague plutôt que faux quand les années sont inconnues", () => {
    expect(periodLabel("all")).toBe("toutes sessions confondues");
  });
});

describe("buildDisclosureText", () => {
  it("porte la note, l'effectif et la période", () => {
    const text = buildDisclosureText({
      formationName: "Facilitation graphique",
      stat: { average: 4.6, count: 142 },
      year: "2026",
    });

    expect(text).toContain("Facilitation graphique — satisfaction : 4,6/5 sur 142 avis (sessions 2026).");
  });

  it("écrit la note avec une décimale même quand elle est ronde", () => {
    const text = buildDisclosureText({
      formationName: "Sketchnoting",
      stat: { average: 5, count: 8 },
      year: "2025",
    });

    expect(text).toContain("5,0/5 sur 8 avis");
  });

  it("décrit la méthode de calcul, sans quoi le taux n'est pas diffusable", () => {
    const text = buildDisclosureText({
      formationName: "Intelligence collective",
      stat: { average: 4.2, count: 30 },
      year: "all",
      coveredYears: ["2025", "2026"],
    });

    expect(text).toContain("Méthode de calcul");
    expect(text).toContain("réponses effectivement soumises et notées");
    expect(text).toContain("l'année retenue est celle de la session suivie");
    expect(text).toContain("(sessions 2025 à 2026)");
  });
});
