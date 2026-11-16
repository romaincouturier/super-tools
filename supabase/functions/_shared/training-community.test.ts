import { describe, expect, it } from "vitest";
import { includeTrainingCommunity, trainingCommunityUrl } from "./training-community";

describe("communauté de formation", () => {
  const app = "https://academy.supertilt.fr";
  const linkedin = "https://www.linkedin.com/groups/13909349/";
  it("priorise la communauté interne sur LinkedIn", () => {
    expect(trainingCommunityUrl({ community_lms_course_id: "cours", private_group_url: linkedin }, app)).toBe(`${app}/espace-apprenant/pratique?fromCourse=cours`);
  });
  it("ouvre la vue staff dans les alertes", () => {
    expect(trainingCommunityUrl({ community_lms_course_id: "cours" }, app, true)).toBe(`${app}/lms/communautes/cours`);
  });
  it("un lien supprimé ne crée aucune communauté implicite", () => {
    expect(trainingCommunityUrl({ private_group_url: " " }, app)).toBeNull();
  });
  it("conserve les autres groupes externes", () => {
    expect(trainingCommunityUrl({ private_group_url: linkedin }, app)).toBe(linkedin);
  });
  it("écarte les liens non HTTP", () => {
    expect(trainingCommunityUrl({ private_group_url: "javascript:alert(1)" }, app)).toBeNull();
  });
  it("remplace le lien externe résiduel du modèle sans doubler le lien interne", () => {
    const training = { community_lms_course_id: "cours", private_group_url: linkedin };
    const html = includeTrainingCommunity(`<a href="${linkedin}">${linkedin}</a>`, training, app);
    expect(html).not.toContain(linkedin);
    expect(includeTrainingCommunity(html, training, app)).toBe(html);
  });
});