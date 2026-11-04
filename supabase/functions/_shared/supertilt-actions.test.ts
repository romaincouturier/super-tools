import { describe, it, expect } from "vitest";
import { fetchSupertiltActions } from "./daily-data-fetchers";

function mockSupabase(tables: Record<string, unknown[]>) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  return {
    calls,
    from(table: string) {
      const res = { data: tables[table] ?? [], error: null };
      const entry = { table, filters: [] as [string, unknown][] };
      calls.push(entry);
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          entry.filters.push([col, val]);
          return q;
        },
        not: () => q,
        lte: (col: string, val: unknown) => {
          entry.filters.push([col, val]);
          return q;
        },
        then: (r: any) => Promise.resolve(res).then(r),
      };
      return q;
    },
  } as any;
}

const ACTION = {
  id: "a1",
  user_id: "u-owner",
  title: "Refaire la page tarifs",
  description: null,
  assigned_to: null,
  deadline: null,
  mission_id: null,
  board: "site",
};

describe("fetchSupertiltActions", () => {
  it("remonte toutes les actions en attente, y compris sans deadline", async () => {
    const sb = mockSupabase({ supertilt_actions: [ACTION], profiles: [] });
    const items = await fetchSupertiltActions(sb, "2026-11-03");
    expect(items).toHaveLength(1);
    const filters = sb.calls.find((c) => c.table === "supertilt_actions")!.filters;
    expect(filters).toContainEqual(["is_completed", false]);
    expect(filters.some(([col]) => col === "deadline")).toBe(false);
  });

  it("attribue l'action à l'assigné résolu par son nom, sinon au créateur", async () => {
    const sb = mockSupabase({
      supertilt_actions: [
        { ...ACTION, id: "a1", assigned_to: "Emmanuelle Marceau" },
        { ...ACTION, id: "a2", assigned_to: "Inconnu" },
        { ...ACTION, id: "a3", assigned_to: null },
      ],
      profiles: [
        { user_id: "u-manue", first_name: "Emmanuelle", last_name: "Marceau", display_name: null },
      ],
    });
    const items = await fetchSupertiltActions(sb, "2026-11-03");
    expect(items.find((i) => i.id === "a1")!.assignedTo).toBe("u-manue");
    expect(items.find((i) => i.id === "a2")!.assignedTo).toBe("u-owner");
    expect(items.find((i) => i.id === "a3")!.assignedTo).toBe("u-owner");
  });

  it("marque en retard uniquement les deadlines dépassées", async () => {
    const sb = mockSupabase({
      supertilt_actions: [
        { ...ACTION, id: "a1", deadline: "2026-11-01" },
        { ...ACTION, id: "a2", deadline: "2026-11-10" },
      ],
      profiles: [],
    });
    const items = await fetchSupertiltActions(sb, "2026-11-03");
    expect(items.find((i) => i.id === "a1")!.isOverdue).toBe(true);
    expect(items.find((i) => i.id === "a2")!.isOverdue).toBe(false);
  });
});
