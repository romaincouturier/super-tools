import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, calls: [] as [string, unknown[]][] }));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["from", "select", "insert", "update", "delete", "eq", "order", "single"]) {
    chain[m] = (...args: unknown[]) => { h.calls.push([m, args]); return chain; };
  }
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(h.result);
  return { supabase: { from: chain.from, rpc: (...args: unknown[]) => { h.calls.push(["rpc", args]); return Promise.resolve(h.result); } } };
});

import {
  THEME_NAME_EMPTY_MESSAGE,
  THEME_NAME_TAKEN_MESSAGE,
  createTheme,
  saveGroupWithPosts,
  updateTheme,
} from "./socialContents";

beforeEach(() => {
  h.calls = [];
  h.result = { data: { id: "t1", name: "IA", color: "#3b82f6" }, error: null };
});

describe("thèmes : service", () => {
  it("crée un thème au nom nettoyé et à la couleur en minuscules", async () => {
    await createTheme({ name: "  IA  ", color: "#3B82F6" });
    expect(h.calls.find(([m]) => m === "insert")?.[1]).toEqual([{ name: "IA", color: "#3b82f6" }]);
  });

  it("traduit la violation d'unicité en message clair", async () => {
    h.result = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
    await expect(createTheme({ name: "ia", color: "#3b82f6" })).rejects.toThrow(THEME_NAME_TAKEN_MESSAGE);
    await expect(updateTheme("t1", { name: "ia" })).rejects.toThrow(THEME_NAME_TAKEN_MESSAGE);
  });

  it("refuse un nom vide sans appel à la base", async () => {
    await expect(createTheme({ name: "  ", color: "#3b82f6" })).rejects.toThrow(THEME_NAME_EMPTY_MESSAGE);
    await expect(updateTheme("t1", { name: "" })).rejects.toThrow(THEME_NAME_EMPTY_MESSAGE);
    expect(h.calls).toEqual([]);
  });

  it("transmet le thème du contenu à la RPC d'enregistrement", async () => {
    h.result = { data: "g", error: null };
    await saveGroupWithPosts({
      groupId: "g", format: "post", sync: true, themeId: "t1", channelIds: ["li"],
      commonText: "x", texts: {}, commonMediaId: null, mediaIds: {}, scheduledAt: null,
    });
    const [, args] = h.calls.find(([m]) => m === "rpc") as [string, unknown[]];
    expect(args[0]).toBe("save_social_content_group");
    expect(args[1]).toMatchObject({ p_group_id: "g", p_theme_id: "t1" });
  });
});
