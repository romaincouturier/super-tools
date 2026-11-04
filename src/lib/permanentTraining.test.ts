import { describe, expect, it } from "vitest";
import { orderCourseOptions, soloFormulaValues } from "./permanentTraining";

describe("Session permanente", () => {
  it("classe les cours libres avant les cours liés, alphabétiquement dans chaque groupe", () => {
    const courses = [
      { id: "1", title: "Zèbre", formation_config_id: null },
      { id: "2", title: "Agilité", formation_config_id: "catalog" },
      { id: "3", title: "Dessin", formation_config_id: null },
      { id: "4", title: "Écriture", formation_config_id: null },
    ];
    expect(orderCourseOptions(courses, ["4"]).map(c => [c.id, c.isAssigned])).toEqual([["3", false], ["1", false], ["2", true], ["4", true]]);
    expect(courses[0].id).toBe("1");
  });
  it("crée Solo en conservant les tarifs et la durée du catalogue sans séances ajoutées", () => {
    const values = soloFormulaValues({ id: "catalog", duree_heures: 12, prix: 249, elearning_access_email_content: null, supports_url: null, woocommerce_product_id: 123, learndash_course_id: null });
    expect(values).toEqual({ formation_config_id: "catalog", name: "Solo", duree_heures: 12, prix: 249, elearning_access_email_content: null, supports_url: null, woocommerce_product_id: 123, learndash_course_id: null, display_order: 0, coaching_sessions_count: 0 });
  });
  it("ne transforme pas un tarif absent en gratuit", () => {
    expect(soloFormulaValues({ id: "catalog", duree_heures: null, prix: null, elearning_access_email_content: null, supports_url: null, woocommerce_product_id: null, learndash_course_id: null }).prix).toBeNull();
  });
});