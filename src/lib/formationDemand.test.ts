import { describe, it, expect } from "vitest";
import {
  baseFormationLabel,
  normalizeFormationName,
  countDevisByFormation,
  sortFormationConfigsByDevis,
} from "./formationDemand";

describe("baseFormationLabel", () => {
  it("supprime la formule après le tiret cadratin", () => {
    expect(baseFormationLabel("Formation facilitation graphique — Formule 2 jours"))
      .toBe("Formation facilitation graphique");
    expect(baseFormationLabel("Formation seule")).toBe("Formation seule");
  });
});

describe("normalizeFormationName", () => {
  it("ignore la casse, les accents et la ponctuation", () => {
    expect(normalizeFormationName("Formation en ligne à la Facilitation graphique"))
      .toBe("formation ligne facilitation graphique");
  });

  it("ignore le contenu entre parenthèses", () => {
    expect(
      normalizeFormationName("Formation facilitation graphique, communiquer avec le visuel (indépendant)"),
    ).toBe("formation facilitation graphique communiquer visuel");
  });

  it("rapproche un ancien intitulé du catalogue actuel", () => {
    expect(normalizeFormationName("Formation en ligne Facilitation graphique (Offre Solo)"))
      .toBe(normalizeFormationName("Formation en ligne à la Facilitation graphique"));
  });

  it("ne fusionne pas deux formations différentes", () => {
    expect(normalizeFormationName("Formation facilitation graphique, communiquer avec le visuel"))
      .not.toBe(normalizeFormationName("Facilitation graphique, communiquer avec le visuel"));
  });
});

describe("countDevisByFormation", () => {
  it("additionne les variantes d'intitulé d'une même formation", () => {
    const counts = countDevisByFormation([
      "Formation facilitation graphique, communiquer avec le visuel",
      "Formation facilitation graphique, communiquer avec le visuel (indépendant)",
      "Formation facilitation graphique, communiquer avec le visuel (individuel)",
      "Formation en ligne à la Facilitation graphique",
      "Formation en ligne Facilitation graphique (Offre facilitateur graphique)",
    ]);
    expect(counts.get("formation facilitation graphique communiquer visuel")).toBe(3);
    expect(counts.get("formation ligne facilitation graphique")).toBe(2);
  });

  it("ignore les libellés vides", () => {
    expect(countDevisByFormation(["", undefined as unknown as string]).size).toBe(0);
  });
});

describe("sortFormationConfigsByDevis", () => {
  it("trie du plus demandé au moins demandé, ex æquo dans l'ordre existant", () => {
    const configs = [
      { formation_name: "Formation en ligne à la Facilitation graphique" },
      { formation_name: "Produire des vidéos dessinées" },
      { formation_name: "Formation facilitation graphique, communiquer avec le visuel" },
      { formation_name: "Icebreaker mode d'emploi" },
    ];
    const demand = countDevisByFormation([
      "Formation facilitation graphique, communiquer avec le visuel — Formule 2 jours",
      "Formation facilitation graphique, communiquer avec le visuel (indépendant)",
      "Formation en ligne à la Facilitation graphique",
    ]);
    const sorted = sortFormationConfigsByDevis(configs, demand);
    expect(sorted.map((c) => c.formation_name)).toEqual([
      "Formation facilitation graphique, communiquer avec le visuel",
      "Formation en ligne à la Facilitation graphique",
      "Produire des vidéos dessinées",
      "Icebreaker mode d'emploi",
    ]);
  });

  it("ne réordonne rien quand aucun devis n'est compté", () => {
    const configs = [
      { formation_name: "A" },
      { formation_name: "B" },
    ];
    const sorted = sortFormationConfigsByDevis(configs, new Map());
    expect(sorted).toEqual(configs);
  });
});
