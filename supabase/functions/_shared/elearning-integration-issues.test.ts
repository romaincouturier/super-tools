import { describe, it, expect } from "vitest";
import { fetchElearningIntegrationIssues } from "./daily-data-fetchers";

function mockSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const res = { data: tables[table] ?? [], error: null };
      const q: any = { select: () => q, not: () => q, then: (r: any) => Promise.resolve(res).then(r) };
      return q;
    },
  } as any;
}

describe("fetchElearningIntegrationIssues", () => {
  it("ne signale pas « Aucune session » pour un cours gratuit", async () => {
    const issues = await fetchElearningIntegrationIssues(
      mockSupabase({ lms_courses: [{ id: "c1", title: "Icebreakers", access_type: "gratuit", status: "published" }] }),
    );
    expect(issues).toEqual([]);
  });

  it("ne signale pas « Produit Woo manquant » pour un cours gratuit", async () => {
    const issues = await fetchElearningIntegrationIssues(
      mockSupabase({
        lms_courses: [{ id: "c1", title: "Agilité", access_type: "gratuit", status: "published" }],
        trainings: [{ id: "t1", supports_lms_course_id: "c1", catalog_id: "k1" }],
        formation_formulas: [{ id: "f1", formation_config_id: "k1", woocommerce_product_id: null, prix: 90 }],
      }),
    );
    expect(issues).toEqual([]);
  });

  it("signale toujours « Aucune session » pour un cours payant", async () => {
    const issues = await fetchElearningIntegrationIssues(
      mockSupabase({ lms_courses: [{ id: "c2", title: "Clean code", access_type: "payant", status: "published" }] }),
    );
    expect(issues.map((i) => i.statusLabel)).toEqual(["Aucune session"]);
  });
});
