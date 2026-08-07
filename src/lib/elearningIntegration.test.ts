import { describe, it, expect } from "vitest";
import {
  computeCourseIntegration,
  sortBySeverity,
  summarize,
  type CourseLike,
  type TrainingLike,
  type TrainingFormulaLink,
  type FormulaLike,
} from "./elearningIntegration";

const course = (over: Partial<CourseLike> = {}): CourseLike => ({
  id: "c1",
  title: "Cours test",
  access_type: "payant",
  ...over,
});

const training = (over: Partial<TrainingLike> = {}): TrainingLike => ({
  id: "t1",
  training_name: "Session e-learning permanente",
  is_cancelled: false,
  catalog_id: null,
  supports_lms_course_id: "c1",
  ...over,
});

const formula = (over: Partial<FormulaLike> = {}): FormulaLike => ({
  id: "f1",
  name: "Formule solo",
  formation_config_id: null,
  woocommerce_product_id: 42,
  ...over,
});

const link = (training_id: string, formula_id: string): TrainingFormulaLink => ({ training_id, formula_id });

describe("computeCourseIntegration", () => {
  it("intra course is not applicable", () => {
    const r = computeCourseIntegration(course({ access_type: "intra" }), [training()], [link("t1", "f1")], [formula()]);
    expect(r.status).toBe("not_applicable");
    expect(r.action).toBeNull();
  });

  it("no session pointing to the course", () => {
    const r = computeCourseIntegration(course(), [training({ supports_lms_course_id: "other" })], [], [formula()]);
    expect(r.status).toBe("no_session");
    expect(r.trainings).toHaveLength(0);
    expect(r.actions).toEqual([
      { label: "Créer la formation dans le catalogue", to: "/catalogue" },
      { label: "Créer une session e-learning", to: "/formations" },
    ]);
  });

  it("cancelled sessions are ignored", () => {
    const r = computeCourseIntegration(course(), [training({ is_cancelled: true })], [link("t1", "f1")], [formula()]);
    expect(r.status).toBe("no_session");
  });

  it("session linked but no formula", () => {
    const r = computeCourseIntegration(course(), [training()], [], [formula()]);
    expect(r.status).toBe("no_formula");
    expect(r.trainings).toHaveLength(1);
  });

  it("formula linked but without woo product id", () => {
    const r = computeCourseIntegration(course(), [training()], [link("t1", "f1")], [formula({ woocommerce_product_id: null })]);
    expect(r.status).toBe("no_woo");
  });

  it("complete explicit chain is ok", () => {
    const r = computeCourseIntegration(course(), [training()], [link("t1", "f1")], [formula()]);
    expect(r.status).toBe("ok");
    expect(r.wooProductIds).toEqual([42]);
    expect(r.action).toBeNull();
  });

  it("works only via catalog_id fallback", () => {
    const r = computeCourseIntegration(
      course(),
      [training({ catalog_id: "cfg1" })],
      [], // no explicit training_formulas link
      [formula({ formation_config_id: "cfg1" })],
    );
    expect(r.status).toBe("ok_fallback");
    expect(r.wooProductIds).toEqual([42]);
    expect(r.action).not.toBeNull();
  });

  it("prefers explicit link over fallback for the ok status", () => {
    const r = computeCourseIntegration(
      course(),
      [training({ catalog_id: "cfg1" })],
      [link("t1", "f1")],
      [formula({ id: "f1", woocommerce_product_id: 42, formation_config_id: "cfg1" })],
    );
    expect(r.status).toBe("ok");
  });
});

describe("summarize + sort", () => {
  it("counts healthy, toFix and not applicable", () => {
    const list = [
      computeCourseIntegration(course({ id: "a", title: "A" }), [training({ supports_lms_course_id: "a" })], [link("t1", "f1")], [formula()]),
      computeCourseIntegration(course({ id: "b", title: "B" }), [], [], []),
      computeCourseIntegration(course({ id: "c", title: "C", access_type: "intra" }), [], [], []),
    ];
    const s = summarize(list);
    expect(s).toEqual({ total: 3, healthy: 1, toFix: 1, notApplicable: 1 });
  });

  it("sorts most problematic first", () => {
    const ok = computeCourseIntegration(course({ id: "a", title: "A" }), [training({ supports_lms_course_id: "a" })], [link("t1", "f1")], [formula()]);
    const broken = computeCourseIntegration(course({ id: "b", title: "B" }), [], [], []);
    const sorted = sortBySeverity([ok, broken]);
    expect(sorted[0].status).toBe("no_session");
    expect(sorted[1].status).toBe("ok");
  });
});
