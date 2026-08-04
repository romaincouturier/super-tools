import { describe, expect, it } from "vitest";
import {
  daysUntil,
  dedupKey,
  matchTender,
  normalizeText,
  parseSettingList,
  type TenderFilterConfig,
} from "./tender-tools.ts";

const CONFIG: TenderFilterConfig = {
  cpvCodes: ["79822500", "80530000"],
  keywords: ["facilitation graphique", "intelligence collective"],
  exclusions: ["bâtiment", "restauration collective"],
};

describe("parseSettingList", () => {
  it("découpe, nettoie et ignore les entrées vides", () => {
    expect(parseSettingList(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseSettingList(null)).toEqual([]);
    expect(parseSettingList("")).toEqual([]);
  });
});

describe("normalizeText", () => {
  it("supprime les accents et passe en minuscules", () => {
    expect(normalizeText("Bâtiment Éducatif")).toBe("batiment educatif");
    expect(normalizeText(null)).toBe("");
  });
});

describe("matchTender", () => {
  it("retient sur un code CPV surveillé", () => {
    const m = matchTender(
      { objet: "Prestations de création de supports visuels", cpvCodes: ["79822500"] },
      CONFIG,
    );
    expect(m.keep).toBe(true);
    expect(m.matched).toEqual(["79822500"]);
  });

  it("retient sur un mot-clé de l'objet, même accentué différemment", () => {
    const m = matchTender({ objet: "Marché de FACILITATION GRAPHIQUE pour la ville" }, CONFIG);
    expect(m.keep).toBe(true);
    expect(m.matched).toEqual(["facilitation graphique"]);
  });

  it("cumule CPV et mots-clés", () => {
    const m = matchTender(
      { objet: "Ateliers d'intelligence collective", cpvCodes: ["80530000"] },
      CONFIG,
    );
    expect(m.matched).toEqual(["80530000", "intelligence collective"]);
  });

  it("écarte le hors-sujet malgré un mot-clé présent", () => {
    // Le cas réel : un marché de travaux qui parle d'« intelligence collective »
    // dans son préambule.
    const m = matchTender(
      { objet: "Travaux de bâtiment avec démarche d'intelligence collective" },
      CONFIG,
    );
    expect(m.keep).toBe(false);
    expect(m.excludedBy).toBe("bâtiment");
    expect(m.matched).toEqual([]);
  });

  it("ne retient rien quand aucun critère ne correspond", () => {
    const m = matchTender({ objet: "Fourniture de papeterie", cpvCodes: ["30190000"] }, CONFIG);
    expect(m.keep).toBe(false);
    expect(m.excludedBy).toBeNull();
  });

  it("cherche aussi dans le texte complémentaire fourni", () => {
    const m = matchTender(
      { objet: "Accord-cadre prestations intellectuelles", extraText: "Lot 4 : facilitation graphique" },
      CONFIG,
    );
    expect(m.keep).toBe(true);
  });

  // Le mot-clé « intelligence artificielle » seul retenait 22 avis sur deux
  // mois, dont vingt de matériel et de développement informatique : le terme
  // est trop porteur pour dire quoi que ce soit. Les formulations retenues
  // nomment l'usage et non la technologie.
  describe("mots-clés IA resserrés", () => {
    const IA_CONFIG: TenderFilterConfig = {
      cpvCodes: [],
      keywords: ["intelligence artificielle générative", "ia générative", "prompt engineering"],
      exclusions: [],
    };

    it("retient une formation à l'IA générative", () => {
      const m = matchTender(
        {
          objet:
            "Prestations de formation à l'ingénierie de requête (prompt engineering) et à " +
            "l'intelligence artificielle générative pour les collaborateurs de l'INPI",
        },
        IA_CONFIG,
      );
      expect(m.keep).toBe(true);
      expect(m.matched).toEqual(["intelligence artificielle générative", "prompt engineering"]);
    });

    it("écarte le matériel et l'informatique qui mentionnent l'IA", () => {
      for (const objet of [
        "Fourniture d'un serveur de calcul dédié aux modèles d'intelligence artificielle",
        "Fourniture et installation de dispositifs d'intelligence artificielle pour la détection visuelle de tri",
        "Surveillance du littoral par vidéo en Intelligence Artificielle et modélisation morpho dynamique",
      ]) {
        expect(matchTender({ objet }, IA_CONFIG).keep).toBe(false);
      }
    });
  });
});

describe("dedupKey", () => {
  it("rapproche deux libellés qui ne diffèrent que par la ponctuation", () => {
    const a = dedupKey({
      acheteur: "Communauté Urbaine de Dunkerque",
      objet: "Prestations de facilitation graphique",
      datelimitereponse: "2023-11-22T12:00:00+01:00",
    });
    const b = dedupKey({
      acheteur: "COMMUNAUTE URBAINE DE DUNKERQUE",
      objet: "prestations de  facilitation graphique !",
      datelimitereponse: "2023-11-22T23:59:00+01:00",
    });
    expect(a).toBe(b);
  });

  it("distingue deux marchés du même acheteur", () => {
    const a = dedupKey({ acheteur: "CNFPT", objet: "Formations intelligence collective" });
    const b = dedupKey({ acheteur: "CNFPT", objet: "Formations design thinking" });
    expect(a).not.toBe(b);
  });

  it("renvoie null quand il n'y a rien à rapprocher", () => {
    expect(dedupKey({})).toBeNull();
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-08-03T12:00:00Z");

  it("compte les jours restants", () => {
    expect(daysUntil("2026-08-13T12:00:00Z", now)).toBe(10);
  });

  it("rend un nombre négatif sur une date dépassée", () => {
    expect(daysUntil("2026-08-01T12:00:00Z", now)).toBe(-2);
  });

  it("rend null sur une date absente ou illisible", () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("pas une date", now)).toBeNull();
  });
});
