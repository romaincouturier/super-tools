import { describe, expect, it } from "vitest";
import { findTrainingFormulaIssues, trainingFormulaAlertRecipients, type FormulaAlertTraining } from "./training-formula-alerts";

const training: FormulaAlertTraining = {
  id: "march", training_name: "Facilitation graphique", catalog_id: "fg",
  start_date: "2027-03-18", is_cancelled: false, format_formation: "inter-entreprises",
  session_type: "inter", assigned_to: "owner",
};
const formulas = [{ id: "enterprise", formation_config_id: "fg", woocommerce_product_id: 14700 }];
const today = "2026-11-12";

describe("Sessions boutique sans tarif associé", () => {
  it("détecte le 18 mars 2027 sans association malgré le lien de novembre", () => {
    expect(findTrainingFormulaIssues([training], formulas, [{ training_id: "november", formula_id: "enterprise" }], today).map(t => t.id)).toEqual(["march"]);
  });
  it("produit une seule alerte par session même avec plusieurs tarifs", () => {
    expect(findTrainingFormulaIssues([training], [...formulas, { ...formulas[0], id: "individual" }], [], today)).toHaveLength(1);
  });
  it("résout le manque dès qu'une formule boutique du même catalogue est associée", () => {
    expect(findTrainingFormulaIssues([training], formulas, [{ training_id: "march", formula_id: "enterprise" }], today)).toEqual([]);
  });
  it("ne considère pas une formule d'un autre catalogue comme une association valide", () => {
    expect(findTrainingFormulaIssues([training], [...formulas, { id: "other", formation_config_id: "other", woocommerce_product_id: 42 }], [{ training_id: "march", formula_id: "other" }], today)).toHaveLength(1);
  });
  it.each([
    { is_cancelled: true }, { start_date: "2026-11-11" }, { start_date: null },
    { format_formation: "intra", session_type: "intra" }, { format_formation: "e_learning" },
  ])("exclut les sessions hors périmètre %j", (patch) => {
    expect(findTrainingFormulaIssues([{ ...training, ...patch }], formulas, [], today)).toEqual([]);
  });
  it("ignore les catalogues sans tarif vendu dans la boutique", () => {
    expect(findTrainingFormulaIssues([training], [{ ...formulas[0], woocommerce_product_id: null }], [], today)).toEqual([]);
  });
  it("limite l'alerte aux admins et au responsable ayant accès aux formations", () => {
    const recipients = [{ userId: "admin", isAdmin: true }, { userId: "owner", isAdmin: false }, { userId: "other", isAdmin: false }];
    expect(trainingFormulaAlertRecipients(training, recipients, new Set(["owner", "other"]))).toEqual(["admin", "owner"]);
    expect(trainingFormulaAlertRecipients(training, recipients, new Set(["other"]))).toEqual(["admin"]);
  });
});