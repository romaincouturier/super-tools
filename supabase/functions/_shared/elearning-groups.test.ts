import { describe, expect, it } from "vitest";
import { fetchElearningGroups } from "./daily-data-fetchers";

function db(rows: any[]) {
  const query: any = { select: () => query, in: () => query, not: () => query, or: () => query, then: (resolve: any) => Promise.resolve({ data: rows }).then(resolve) };
  return { from: () => query } as any;
}
describe("alertes communautés externes", () => {
  const row = { id: "formation", training_name: "Facilitation", private_group_url: "https://www.linkedin.com/groups/13909349/", start_date: null, end_date: null };
  it("supprime l’alerte LinkedIn quand une communauté interne est choisie", async () => {
    expect(await fetchElearningGroups(db([{ ...row, community_lms_course_id: "cours" }]), "2026-11-16")).toEqual([]);
  });
  it("inclut les sessions permanentes avec communauté externe", async () => {
    expect((await fetchElearningGroups(db([row]), "2026-11-16"))[0].privateGroupUrl).toBe(row.private_group_url);
  });
  it("ne rappelle pas les sessions annulées", async () => {
    expect(await fetchElearningGroups(db([{ ...row, is_cancelled: true }]), "2026-11-16")).toEqual([]);
  });
  it("ne rappelle pas les sessions passées", async () => {
    expect(await fetchElearningGroups(db([{ ...row, end_date: "2026-11-15" }]), "2026-11-16")).toEqual([]);
  });
  it("ne rappelle pas un lien supprimé", async () => {
    expect(await fetchElearningGroups(db([{ ...row, private_group_url: null }]), "2026-11-16")).toEqual([]);
  });
});