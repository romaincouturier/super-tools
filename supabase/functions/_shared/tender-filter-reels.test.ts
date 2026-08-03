import { describe, expect, it } from "vitest";
import { mapBoampRecord } from "./boamp.ts";
import { matchTender } from "./tender-tools.ts";

// Réglages livrés dans la migration.
const CONFIG = {
  cpvCodes: "80000000,80500000,80510000,80511000,80522000,80532000,80533100,80530000,80570000,79400000,79411000,79419000,79822500,79951000,79952000,79998000,79311300".split(","),
  keywords: "facilitation graphique,facilitation,intelligence collective,sketchnote,scribing,co-construction,codesign,design thinking,conduite du changement,acculturation,intelligence artificielle".split(","),
  exclusions: "bâtiment,travaux de construction,restauration collective,transport scolaire,voirie,assainissement,nettoyage,sécurité incendie,fourniture de carburant,espaces verts".split(","),
};

const rec = (o: Record<string, unknown>) => ({ idweb: "x", type_marche: ["SERVICES"], ...o });

describe("filtre livré, sur des avis réels", () => {
  it("retient la facilitation graphique de Dunkerque", () => {
    const t = mapBoampRecord(rec({
      objet: "Prestations de facilitation graphique et de création de supports visuels",
      donnees: JSON.stringify({ OBJET: { CPV: { PRINCIPAL: "79822500" } } }),
    }));
    const m = matchTender({ objet: t.objet, cpvCodes: t.cpv_codes }, CONFIG);
    expect(m.keep).toBe(true);
  });

  it("retient le CNFPT intelligence collective", () => {
    const t = mapBoampRecord(rec({
      objet: "Réalisation d'actions de formations aux techniques d'intelligence collective, facilitation, créativité",
      donnees: JSON.stringify({ OBJET: { CPV: { PRINCIPAL: "80530000" } } }),
    }));
    expect(matchTender({ objet: t.objet, cpvCodes: t.cpv_codes }, CONFIG).keep).toBe(true);
  });

  it("écarte la ZAC de Château-Gaillard, qui matche pourtant en plein texte", () => {
    const t = mapBoampRecord(rec({
      objet: "concession d'aménagement pour la réalisation de la ZAC de Château-Gaillard",
      donnees: JSON.stringify({ OBJET: { CPV: [{ PRINCIPAL: "45111291" }, { PRINCIPAL: "71000000" }] } }),
    }));
    const m = matchTender({ objet: t.objet, cpvCodes: t.cpv_codes }, CONFIG);
    expect(m.keep).toBe(false);
  });

  it("écarte l'animation de bassins de captage malgré le mot facilitation", () => {
    const t = mapBoampRecord(rec({
      objet: "Mise en oeuvre d'une Démarche d'animation et de facilitation autour des Bassins d'alimentation de captages",
      donnees: JSON.stringify({ OBJET: {} }),
    }));
    const m = matchTender({ objet: t.objet, cpvCodes: t.cpv_codes }, CONFIG);
    // Aucun mot d'exclusion ne s'applique : il passe. C'est assumé, il sera
    // écarté à la main et son motif servira à enrichir la liste d'exclusions.
    expect(m.keep).toBe(true);
    expect(m.matched).toEqual(["facilitation"]);
  });

  it("retient l'accord-cadre DITP via le lot, pas via l'objet", () => {
    const t = mapBoampRecord(rec({
      objet: "Prestations en design de services et parcours utilisateurs, sciences comportementales",
      donnees: JSON.stringify({
        OBJET: { CPV: { PRINCIPAL: "79311300" }, LOTS: { LOT: [{ INTITULE: "Intelligence collective et facilitation" }] } },
      }),
    }));
    const m = matchTender(
      { objet: t.objet, cpvCodes: t.cpv_codes, extraText: t.decision.lots.join(" ") },
      CONFIG,
    );
    expect(m.keep).toBe(true);
    expect(m.matched).toContain("intelligence collective");
  });
});
