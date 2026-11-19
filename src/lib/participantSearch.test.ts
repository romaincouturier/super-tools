import { describe, expect, it } from "vitest";
import { filterParticipantsBySearch } from "./participantSearch";

const participants = [
  { email: "marine.barbaud@exemple.fr", first_name: "Marine", last_name: "Barbaud", company: "Hôpital Léopold Bellan" },
  { email: "j.dupont@supertilt.fr", first_name: null, last_name: null, company: null },
  { email: "ezequiel@orange.fr", first_name: "Ézéquiël", last_name: "Nuñez", company: "Mairie de Lyon" },
];

const emails = (term: string) => filterParticipantsBySearch(participants, term).map((p) => p.email);

describe("Recherche de participants", () => {
  it("retourne tous les participants sans terme", () => {
    expect(emails("")).toHaveLength(3);
    expect(emails("   ")).toHaveLength(3);
  });

  it("trouve un inscrit e-learning par son email seul", () => {
    expect(emails("j.dupont")).toEqual(["j.dupont@supertilt.fr"]);
    expect(emails("dupont@supertilt")).toEqual(["j.dupont@supertilt.fr"]);
  });

  it("ignore la casse", () => {
    expect(emails("MARINE.BARBAUD")).toEqual(["marine.barbaud@exemple.fr"]);
    expect(emails("Barbaud")).toEqual(["marine.barbaud@exemple.fr"]);
  });

  it("ignore les accents", () => {
    expect(emails("ezequiel")).toEqual(["ezequiel@orange.fr"]);
    expect(emails("nunez")).toEqual(["ezequiel@orange.fr"]);
    expect(emails("leopold")).toEqual(["marine.barbaud@exemple.fr"]);
  });

  it("accepte nom et prénom dans n'importe quel ordre", () => {
    expect(emails("marine barbaud")).toEqual(["marine.barbaud@exemple.fr"]);
    expect(emails("barbaud marine")).toEqual(["marine.barbaud@exemple.fr"]);
  });

  it("cherche l'entreprise et l'email ensemble", () => {
    expect(emails("mairie lyon")).toEqual(["ezequiel@orange.fr"]);
    expect(emails("orange lyon")).toEqual(["ezequiel@orange.fr"]);
  });

  it("ne retourne personne si un mot ne correspond à aucun champ", () => {
    expect(emails("barbaud orange")).toEqual([]);
    expect(emails("inconnu")).toEqual([]);
  });

  it("ne mute pas la liste reçue", () => {
    const input = [...participants];
    filterParticipantsBySearch(input, "barbaud");
    expect(input).toHaveLength(3);
  });
});
