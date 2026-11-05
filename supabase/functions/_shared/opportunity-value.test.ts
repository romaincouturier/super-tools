import { describe, it, expect } from "vitest";
import { estimateOpportunityValue, matchCatalogFormation, type CatalogFormation, type WonOpportunity } from "./opportunity-value";

const catalog: CatalogFormation[] = [
  { name: "Formation facilitation graphique, communiquer avec le visuel", price: 1249, formulas: [
    { name: "Particuliers & demandeurs d'emploi", price: 649 }, { name: "Entreprises", price: 1249 } ] },
  { name: "Formation en ligne à la Facilitation graphique", price: 0, formulas: [
    { name: "Solo", price: 99 }, { name: "Coaché", price: 539 } ] },
  { name: "Faciliter l'intelligence collective", price: 5985, formulas: [] },
];
const won: WonOpportunity[] = [
  { estimated_value: 6000, service_type: "formation", company: "A", title: "Facilitation graphique communiquer avec le visuel intra" },
  { estimated_value: 8000, service_type: "formation", company: "B", title: "Facilitation graphique, communiquer avec le visuel" },
  { estimated_value: 1249, service_type: "formation", company: "C", title: "Facilitation graphique communiquer avec le visuel" },
  { estimated_value: 2000, service_type: "mission", company: "Acme", title: "Mission" },
  { estimated_value: 3000, service_type: "mission", company: "Other", title: "Mission" },
  { estimated_value: 10000, service_type: "mission", company: "Other", title: "Mission" },
];

describe("estimateOpportunityValue", () => {
  it("inter : prix catalogue Entreprises par personne", () => {
    const r = estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "Formation facilitation graphique, communiquer avec le visuel", format: "inter", participants: 2 }, catalog, won);
    expect(r.value).toBe(2500);
  });
  it("inter sans effectif : une personne", () => {
    const r = estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "facilitation graphique communiquer avec le visuel", format: "inter" }, catalog, won);
    expect(r.value).toBe(1250);
  });
  it("intra avec effectif : prix × participants", () => {
    const r = estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "Formation facilitation graphique, communiquer avec le visuel", format: "intra", participants: 8 }, catalog, won);
    expect(r.value).toBe(9990);
  });
  it("intra sans effectif : médiane des intra gagnés de la formation", () => {
    const r = estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "Formation facilitation graphique, communiquer avec le visuel", format: "intra" }, catalog, won);
    expect(r.value).toBe(7000);
    expect(r.count).toBe(2);
  });
  it("e-learning : formule la moins chère", () => {
    const r = estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "Formation en ligne à la Facilitation graphique", format: "elearning" }, catalog, won);
    expect(r.value).toBe(100);
  });
  it("mission : médiane du client, sinon de toutes les missions", () => {
    expect(estimateOpportunityValue({ service_type: "mission", company: "acme" }, catalog, won).value).toBe(2000);
    expect(estimateOpportunityValue({ service_type: "mission", company: "Nouveau" }, catalog, won).value).toBe(3000);
  });
  it("formation hors catalogue : médiane des formations gagnées", () => {
    expect(estimateOpportunityValue({ service_type: "formation", company: null, formation_name: "Management agile" }, catalog, won).value).toBe(6000);
  });
  it("ne rapproche pas des formations sans lien", () => {
    expect(matchCatalogFormation("Gestion du temps", catalog)).toBeNull();
  });
});
