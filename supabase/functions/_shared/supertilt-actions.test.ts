import { describe, it, expect, vi } from "vitest";
import { fetchSupertiltActions, fetchRecipients } from "./daily-data-fetchers";
import { canonicalAssignee, resolveProjectAssignee, requireCanonicalAssignee } from "./project-assignee";
import { createProjectAction, updateProjectAction } from "./project-board-tools";

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
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: tables[table]?.[0], error: null }),
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
    const filters = sb.calls.find((c) => c.table === "supertilt_actions")?.filters || [];
    expect(filters).toContainEqual(["is_completed", false]);
    expect(filters.some(([col]) => col === "deadline")).toBe(false);
  });

  it("résout un email sans attribuer l'action au créateur", async () => {
    const sb = mockSupabase({
      supertilt_actions: [{ ...ACTION, assigned_to: "romain@supertilt.fr" }],
      profiles: [{ user_id: "u-romain", display_name: "Romain Couturier", first_name: "Romain", last_name: "Couturier", email: "romain@supertilt.fr" }],
    });
    const items = await fetchSupertiltActions(sb, "2026-11-11");
    expect(items[0].assignedTo).toBe("u-romain");
  });

  it("signale un assigné inconnu au créateur et aux admins", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sb = mockSupabase({
      supertilt_actions: [
        { ...ACTION, id: "a1", assigned_to: "Emmanuelle Marceau" },
        { ...ACTION, id: "a2", assigned_to: "Inconnu" },
        { ...ACTION, id: "a3", assigned_to: null },
      ],
      profiles: [
        { user_id: "u-manue", first_name: "Emmanuelle", last_name: "Marceau", display_name: null },
        { user_id: "u-admin", is_admin: true },
      ],
    });
    const items = await fetchSupertiltActions(sb, "2026-11-03");
    expect(items.find((i) => i.id === "a1")?.assignedTo).toBe("u-manue");
    expect(items.find((i) => i.id === "a2")?.assignedTo).toBeNull();
    expect(items.find((i) => i.id === "a2")?.targetUserIds).toEqual(["u-owner", "u-admin"]);
    expect(items.find((i) => i.id === "a2")?.assignmentWarning).toBe("assigné inconnu : Inconnu");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("assigné inconnu : Inconnu"));
    expect(items.find((i) => i.id === "a3")?.assignedTo).toBe("u-owner");
    warning.mockRestore();
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
    expect(items.find((i) => i.id === "a1")?.isOverdue).toBe(true);
    expect(items.find((i) => i.id === "a2")?.isOverdue).toBe(false);
  });
});

const ROMAIN = { user_id: "u-romain", display_name: "Romain C.", first_name: "Romain", last_name: "Couturier", email: "romain@supertilt.fr" };

describe("résolution partagée des assignés", () => {
  it("inclut un utilisateur ayant seulement le module projets transverses", async () => {
    const sb = mockSupabase({ profiles: [{ ...ROMAIN, is_admin: false }], user_module_access: [{ user_id: "u-romain", module: "projets_transverses" }] });
    expect((await fetchRecipients(sb)).map((r) => r.userId)).toEqual(["u-romain"]);
  });
  it.each(["Romain C.", "Romain Couturier", "romain@supertilt.fr", "  ROMAIN   COUTURIER  ", "  ROMAIN@SUPERTILT.FR  "])("résout %s vers le même utilisateur", async (value) => {
    const sb = mockSupabase({ supertilt_actions: [{ ...ACTION, assigned_to: value }], profiles: [ROMAIN] });
    const items = await fetchSupertiltActions(sb, "2026-11-11");
    expect(items[0].targetUserIds).toEqual(["u-romain"]);
    expect(items[0].assignedTo).toBe("u-romain");
    expect(await requireCanonicalAssignee(sb, value)).toBe("Romain C.");
  });

  it("choisit le nom affiché puis prénom nom puis email", () => {
    expect(canonicalAssignee(ROMAIN)).toBe("Romain C.");
    expect(canonicalAssignee({ ...ROMAIN, display_name: "  " })).toBe("Romain Couturier");
    expect(canonicalAssignee({ ...ROMAIN, display_name: null, first_name: null, last_name: null })).toBe("romain@supertilt.fr");
  });

  it("refuse une correspondance ambiguë", async () => {
    const users = [ROMAIN, { ...ROMAIN, user_id: "u-other", email: "other@example.invalid" }];
    expect(resolveProjectAssignee("Romain C.", users)).toBeNull();
    await expect(requireCanonicalAssignee(mockSupabase({ profiles: users }), "Romain C.")).rejects.toThrow("inconnu ou ambigu");
  });

  it("n'assigne rien implicitement lorsque l'annuaire échoue", async () => {
    const sb = { from: () => ({ select: async () => ({ error: { message: "permission denied" } }) }) };
    await expect(requireCanonicalAssignee(sb, "Romain C.")).rejects.toThrow("permission denied");
  });

  it("MCP create refuse un assigné inconnu avant toute écriture ou audit", async () => {
    const sb = mockSupabase({ supertilt_columns: [{ id: "col", name: "À faire" }], profiles: [ROMAIN] });
    const audit = vi.fn();
    await expect(createProjectAction(sb, { board: "site", title: "Test", assigned_to: "Inconnu" }, audit)).rejects.toThrow("Assigné inconnu");
    expect(audit).not.toHaveBeenCalled();
  });

  it("MCP update refuse un assigné inconnu avant toute écriture ou audit", async () => {
    const sb = mockSupabase({ supertilt_actions: [ACTION], profiles: [ROMAIN] });
    const audit = vi.fn();
    await expect(updateProjectAction(sb, "1d8a179f-7cbc-4d02-83d2-c28d2a171472", { assigned_to: "Inconnu" }, audit)).rejects.toThrow("Assigné inconnu");
    expect(audit).not.toHaveBeenCalled();
  });
});
