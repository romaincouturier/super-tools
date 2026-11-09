import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPracticePostDetails } from "./practicePostDetails";

const { requests, results, from } = vi.hoisted(() => {
  const requests: { table: string; filter?: [string, unknown[]]; range?: number[] }[] = [];
  const results = new Map<string, { data: any[] | null; error: unknown }[]>();
  const from = vi.fn((table: string) => {
    const request: typeof requests[number] = { table };
    requests.push(request);
    const chain = {
      select: () => chain,
      order: () => chain,
      in: (column: string, ids: unknown[]) => { request.filter = [column, ids]; return chain; },
      range: (start: number, end: number) => {
        request.range = [start, end];
        return Promise.resolve(results.get(table)?.shift() ?? { data: [], error: null });
      },
    };
    return chain;
  });
  return { requests, results, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/lib/supabase-helpers", () => ({ fetchStaffPublicProfiles: async () => [] }));

beforeEach(() => { requests.length = 0; results.clear(); vi.clearAllMocks(); });

describe("Détails des publications affichées", () => {
  it("ne lit aucune table lorsque la page est vide", async () => {
    const details = await fetchPracticePostDetails([]);
    expect(details.comments).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it("borne chaque lecture aux deux publications de l’aperçu", async () => {
    results.set("practice_post_reactions", [{ data: [{ id: "r1", post_id: "p1", author_email: "reader@example.org" }], error: null }]);
    await fetchPracticePostDetails([{ id: "p1", author_email: "author@example.org" }, { id: "p2", author_email: "author@example.org" }]);
    expect(requests.filter((request) => request.table !== "learner_profiles").map((request) => request.filter)).toEqual([
      ["post_id", ["p1", "p2"]], ["post_id", ["p1", "p2"]], ["post_id", ["p1", "p2"]], ["post_id", ["p1", "p2"]],
    ]);
    expect(requests.find((request) => request.table === "learner_profiles")?.filter).toEqual(["email", ["author@example.org", "reader@example.org"]]);
    expect(requests.every((request) => request.range?.[1] === 499)).toBe(true);
  });

  it("conserve 501 commentaires sans tronquer le compteur à une page", async () => {
    results.set("practice_post_comments", [
      { data: Array.from({ length: 500 }, (_, index) => ({ id: `c${index}`, post_id: "p1" })), error: null },
      { data: [{ id: "c500", post_id: "p1" }], error: null },
    ]);
    const details = await fetchPracticePostDetails([{ id: "p1", author_email: "author@example.org" }]);
    expect(details.comments).toHaveLength(501);
    expect(requests.filter((request) => request.table === "practice_post_comments").map((request) => request.range)).toEqual([[0, 499], [500, 999]]);
  });

  it("remonte le timeout du bloc au lieu de prétendre qu’il n’y a aucun commentaire", async () => {
    const error = { code: "57014", message: "canceling statement due to statement timeout" };
    results.set("practice_post_comments", [{ data: null, error }]);
    await expect(fetchPracticePostDetails([{ id: "p1", author_email: "author@example.org" }])).rejects.toEqual(error);
  });
});