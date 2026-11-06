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
  GROUP_NOT_DELETED_MESSAGE,
  POST_NOT_DELETED_MESSAGE,
  THEME_NAME_EMPTY_MESSAGE,
  THEME_NAME_TAKEN_MESSAGE,
  createTheme,
  deleteGroup,
  deletePost,
  saveGroupWithPosts,
  setPostPublished,
  updatePublishedPost,
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

describe("marquage publié et suppression : service", () => {
  it("appelle les RPC de marquage et d'édition d'une publiée", async () => {
    h.result = { data: "published", error: null };
    await expect(setPostPublished("p1", true)).resolves.toBe("published");
    h.result = { data: null, error: null };
    await updatePublishedPost("p1", "Corrigé", "m1");
    expect(h.calls.filter(([m]) => m === "rpc").map(([, a]) => a)).toEqual([
      ["set_social_post_published", { p_post_id: "p1", p_published: true }],
      ["update_social_post_content", { p_post_id: "p1", p_text: "Corrigé", p_media_id: "m1" }],
    ]);
  });

  it("supprime une déclinaison ou tout le contenu par une suppression ciblée", async () => {
    h.result = { data: [{ id: "x" }], error: null };
    await deletePost("p1");
    await deleteGroup("g1");
    expect(h.calls.filter(([m]) => ["from", "delete", "eq", "select"].includes(m))).toEqual([
      ["from", ["social_posts"]], ["delete", []], ["eq", ["id", "p1"]], ["select", ["id"]],
      ["from", ["social_content_groups"]], ["delete", []], ["eq", ["id", "g1"]], ["select", ["id"]],
    ]);
  });

  it("signale une suppression sans ligne supprimée (RLS ou déjà supprimée)", async () => {
    h.result = { data: [], error: null };
    await expect(deletePost("p1")).rejects.toThrow(POST_NOT_DELETED_MESSAGE);
    await expect(deleteGroup("g1")).rejects.toThrow(GROUP_NOT_DELETED_MESSAGE);
  });

  it("propage l'erreur de la base", async () => {
    h.result = { data: null, error: { code: "22023", message: "Planifiez une date pour marquer publié" } };
    await expect(setPostPublished("p1", true)).rejects.toMatchObject({ code: "22023" });
  });
});
