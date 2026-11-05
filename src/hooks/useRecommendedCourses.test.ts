import { describe, it, expect } from "vitest";
import { academyCourseUrl, resolveBoutiqueUrl } from "./useRecommendedCourses";

describe("liens des formations recommandées", () => {
  it("cours gratuit : formation sur SuperTilt Academy", () => {
    expect(academyCourseUrl("abc")).toBe("/academy/choisir-mes-formations?course=abc");
  });
  it("cours payant : fiche produit supertilt.fr", () => {
    expect(resolveBoutiqueUrl("https://supertilt.fr/boutique/x/", 1, "X")).toBe("https://supertilt.fr/boutique/x/");
  });
});
