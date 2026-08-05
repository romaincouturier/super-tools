import { describe, expect, it } from "vitest";
import {
  asArray,
  collectCpv,
  decisionFromEforms,
  deepFind,
  dig,
  numberOf,
  textOf,
} from "./eforms.ts";

/**
 * Ces utilitaires étaient privés dans `boamp.ts` et sont partagés depuis
 * l'ajout du TED. Un module utilisé par deux connecteurs mérite sa propre
 * couverture : les tests du BOAMP ne l'exercent que sur des avis français, et
 * une régression n'apparaîtrait qu'en aval, sur la source qu'on regarde le
 * moins.
 */

describe("asArray", () => {
  it("uniformise objet unique et tableau", () => {
    expect(asArray("a")).toEqual(["a"]);
    expect(asArray(["a", "b"])).toEqual(["a", "b"]);
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });

  it("garde un tableau vide distinct d'une valeur absente", () => {
    expect(asArray([])).toEqual([]);
    // Le zéro et la chaîne vide sont des valeurs, pas des absences.
    expect(asArray(0)).toEqual([0]);
    expect(asArray("")).toEqual([""]);
  });
});

describe("dig", () => {
  it("descend un chemin sans jamais lever", () => {
    expect(dig({ a: { b: { c: 1 } } }, "a", "b", "c")).toBe(1);
    expect(dig({ a: null }, "a", "b")).toBeUndefined();
    expect(dig(null, "a")).toBeUndefined();
    expect(dig("chaîne", "a")).toBeUndefined();
  });
});

describe("textOf", () => {
  // Les attributs XML convertis en JSON donnent { "@DEVISE": ..., "#text": ... }.
  it("lit la forme attribuée comme la chaîne nue", () => {
    expect(textOf("  valeur  ")).toBe("valeur");
    expect(textOf({ "@DEVISE": "EUR", "#text": "20000" })).toBe("20000");
    expect(textOf(42)).toBe("42");
  });

  it("rend null sur une absence ou une chaîne vide", () => {
    expect(textOf(null)).toBeNull();
    expect(textOf(undefined)).toBeNull();
    expect(textOf("   ")).toBeNull();
    expect(textOf({ sans: "texte" })).toBeNull();
  });
});

describe("numberOf", () => {
  it("lit les nombres à la française", () => {
    expect(numberOf("20 000")).toBe(20000);
    expect(numberOf("1234,56")).toBe(1234.56);
    expect(numberOf({ "#text": "500" })).toBe(500);
  });

  it("rend null plutôt qu'un NaN", () => {
    expect(numberOf("pas un nombre")).toBeNull();
    expect(numberOf(null)).toBeNull();
  });
});

describe("deepFind", () => {
  // En eForms, les critères et la durée vivent tantôt au niveau de la
  // procédure, tantôt au niveau de chaque lot : un chemin fixe rend du vide
  // sur la moitié des avis.
  it("trouve une clé à toutes les profondeurs", () => {
    const node = {
      lots: [
        { "cac:AwardingCriterion": { poids: 40 } },
        { imbrique: { "cac:AwardingCriterion": { poids: 60 } } },
      ],
    };
    expect(deepFind(node, "cac:AwardingCriterion")).toEqual([{ poids: 40 }, { poids: 60 }]);
  });

  it("rend un tableau vide plutôt que null", () => {
    expect(deepFind(null, "x")).toEqual([]);
    expect(deepFind({ a: 1 }, "x")).toEqual([]);
  });
});

describe("collectCpv", () => {
  it("lit le schéma XML historique", () => {
    const out = new Set<string>();
    collectCpv({ OBJET: { CPV: { PRINCIPAL: "80533100" } } }, out);
    expect([...out]).toEqual(["80533100"]);
  });

  it("lit le schéma eForms", () => {
    const out = new Set<string>();
    collectCpv({ "cbc:ItemClassificationCode": "79822500" }, out);
    expect([...out]).toEqual(["79822500"]);
  });

  it("collecte les codes des lots comme ceux de la procédure", () => {
    const out = new Set<string>();
    collectCpv(
      {
        CPV: { PRINCIPAL: "80511000" },
        LOTS: [{ CPV: [{ PRINCIPAL: "79951000" }, { PRINCIPAL: "80511000" }] }],
      },
      out,
    );
    expect([...out].sort()).toEqual(["79951000", "80511000"]);
  });

  // Un code à sept ou neuf chiffres n'est pas un CPV : le laisser passer
  // ferait matcher le filtre sur un numéro de marché.
  it("ignore ce qui n'a pas exactement huit chiffres", () => {
    const out = new Set<string>();
    collectCpv({ CPV: { PRINCIPAL: "8053310" } }, out);
    collectCpv({ "cbc:ItemClassificationCode": "805331000" }, out);
    collectCpv({ CPV: { PRINCIPAL: "ABCDEFGH" } }, out);
    expect([...out]).toEqual([]);
  });
});

describe("decisionFromEforms", () => {
  it("lit les lots et les critères d'un avis européen", () => {
    const d = decisionFromEforms({
      EFORMS: {
        ContractNotice: {
          "cac:ProcurementProjectLot": [
            {
              "cac:ProcurementProject": { "cbc:Name": "Lot 1 : facilitation graphique" },
              "cac:TenderingTerms": {
                "cac:AwardingTerms": {
                  "cac:AwardingCriterion": {
                    "cac:SubordinateAwardingCriterion": [
                      { "cbc:Description": "Valeur technique" },
                      { "cbc:Description": "Prix" },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    });
    expect(d.lots).toEqual(["Lot 1 : facilitation graphique"]);
    expect(d.criteres.map((c) => c.libelle)).toEqual(["Valeur technique", "Prix"]);
  });

  // Un avis vide ne doit pas lever : c'est ce qui permet au connecteur de
  // compter ses échecs au lieu de s'arrêter au premier.
  it("rend une décision vide sur un avis sans contenu", () => {
    const d = decisionFromEforms({});
    expect(d.lots).toEqual([]);
    expect(d.criteres).toEqual([]);
    expect(d.montant).toBeNull();
    expect(d.url_dce).toBeNull();
  });
});
