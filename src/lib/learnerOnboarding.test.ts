import { describe, expect, it } from "vitest";
import { getLearnerOnboardingSteps } from "./learnerOnboarding";

describe("étapes de démarrage apprenant", () => {
  it("ne demande aucun dépôt, même sans profil", () => {
    expect(getLearnerOnboardingSteps(null)).toEqual(["avatar", "name"]);
  });

  it("ne conserve aucune étape lorsque photo, prénom et nom sont renseignés", () => {
    expect(getLearnerOnboardingSteps({ photo_url: "photo.jpg", first_name: "Colette", last_name: "Nico" })).toEqual([]);
  });

  it("conserve la photo lorsqu'elle est absente", () => {
    expect(getLearnerOnboardingSteps({ photo_url: " ", first_name: "Colette", last_name: "Nico" })).toEqual(["avatar"]);
  });

  it.each([
    { first_name: "", last_name: "Nico" },
    { first_name: "Colette", last_name: " " },
  ])("conserve l'identité si un nom manque : %j", (names) => {
    expect(getLearnerOnboardingSteps({ photo_url: "photo.jpg", ...names })).toEqual(["name"]);
  });
});