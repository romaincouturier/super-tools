/**
 * Régression : l'ancienne implémentation (regex unique avec groupe optionnel
 * gourmand) renvoyait `r` comme adresse pour `romain@supertilt.fr`, le groupe
 * « nom » avalant tout sauf le dernier caractère. Constaté sur le premier mail
 * réellement reçu par le connecteur, le 03/08/2026.
 */
import { describe, expect, it } from "vitest";
import { parseEmailAddress } from "./email-address.ts";

describe("parseEmailAddress", () => {
  it("garde l'adresse entière quand il n'y a pas de nom", () => {
    expect(parseEmailAddress("romain@supertilt.fr")).toEqual({
      email: "romain@supertilt.fr",
      name: null,
    });
  });

  it("sépare nom et adresse dans la forme à chevrons", () => {
    expect(parseEmailAddress("Romain Couturier <romain@supertilt.fr>")).toEqual({
      email: "romain@supertilt.fr",
      name: "Romain Couturier",
    });
  });

  it("retire les guillemets autour du nom", () => {
    expect(parseEmailAddress('"Couturier, Romain" <romain@supertilt.fr>')).toEqual({
      email: "romain@supertilt.fr",
      name: "Couturier, Romain",
    });
  });

  it("accepte des chevrons sans nom", () => {
    expect(parseEmailAddress("<alerte@place.marches-publics.gouv.fr>")).toEqual({
      email: "alerte@place.marches-publics.gouv.fr",
      name: null,
    });
  });

  it("normalise la casse et les espaces", () => {
    expect(parseEmailAddress("  ROMAIN@Supertilt.FR  ")).toEqual({
      email: "romain@supertilt.fr",
      name: null,
    });
    expect(parseEmailAddress("PLACE <Ne-Pas-Repondre@Place.Gouv.FR>")).toEqual({
      email: "ne-pas-repondre@place.gouv.fr",
      name: "PLACE",
    });
  });

  it("ne casse pas sur une entrée vide ou absurde", () => {
    expect(parseEmailAddress("")).toEqual({ email: "", name: null });
    expect(parseEmailAddress("   ")).toEqual({ email: "", name: null });
    expect(parseEmailAddress("pas une adresse")).toEqual({
      email: "pas une adresse",
      name: null,
    });
  });
});
