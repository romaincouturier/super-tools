import { describe, it, expect } from "vitest";
import {
  LEARNER_HELP_CATEGORIES,
  findHelpCategory,
  helpDestination,
  reclamationFieldsFor,
} from "./learnerHelpRouting";
import { NATURES, PROBLEM_TYPES } from "./reclamationConstants";

describe("helpDestination", () => {
  it("garde au support ce qui relève de l'outil", () => {
    expect(helpDestination("acces_connexion")).toBe("support");
    expect(helpDestination("technique")).toBe("support");
  });

  it("envoie au registre ce qui relève de la prestation", () => {
    expect(helpDestination("pedagogique")).toBe("reclamation");
    expect(helpDestination("administratif")).toBe("reclamation");
    expect(helpDestination("reclamation")).toBe("reclamation");
  });

  // Perdre une demande serait pire que la mal classer : une catégorie
  // inconnue retombe sur la destination historique.
  it("retombe sur le support pour une catégorie inconnue ou vide", () => {
    expect(helpDestination("inconnue")).toBe("support");
    expect(helpDestination("")).toBe("support");
    expect(helpDestination(null)).toBe("support");
    expect(helpDestination(undefined)).toBe("support");
  });
});

describe("reclamationFieldsFor", () => {
  // Une question pédagogique n'est pas une réclamation. Les confondre
  // gonflerait le registre de demandes qui n'en sont pas.
  it("classe une question pédagogique en difficulté", () => {
    expect(reclamationFieldsFor("pedagogique")).toEqual({
      nature: "difficulte",
      problemType: "contenu",
    });
  });

  it("classe une demande administrative en difficulté", () => {
    expect(reclamationFieldsFor("administratif")).toEqual({
      nature: "difficulte",
      problemType: "organisation",
    });
  });

  it("classe une réclamation explicite en réclamation", () => {
    expect(reclamationFieldsFor("reclamation")).toEqual({
      nature: "reclamation",
      problemType: "autre",
    });
  });

  it("ne rend rien pour une catégorie qui part au support", () => {
    expect(reclamationFieldsFor("technique")).toBeNull();
    expect(reclamationFieldsFor("inconnue")).toBeNull();
  });
});

describe("cohérence avec le registre", () => {
  // Une nature ou un type absent des constantes du registre serait refusé
  // par la base ou afficherait un libellé vide dans l'écran Réclamations.
  it("n'utilise que des natures et des types connus du registre", () => {
    const natures = NATURES.map((n) => n.value);
    const types = PROBLEM_TYPES.map((t) => t.value);
    for (const c of LEARNER_HELP_CATEGORIES) {
      if (c.destination !== "reclamation") continue;
      expect(natures).toContain(c.nature);
      expect(types).toContain(c.problemType);
    }
  });

  it("expose des valeurs de catégorie uniques", () => {
    const values = LEARNER_HELP_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("retrouve chaque catégorie par sa valeur", () => {
    for (const c of LEARNER_HELP_CATEGORIES) {
      expect(findHelpCategory(c.value)).toEqual(c);
    }
    expect(findHelpCategory("inconnue")).toBeNull();
  });
});
