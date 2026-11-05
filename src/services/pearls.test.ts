import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  results: {} as Record<string, { data?: unknown; error?: unknown }>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  rpc: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "order", "limit"]) {
      b[m] = (...args: unknown[]) => { h.calls.push({ table, method: m, args }); return b; };
    }
    const settle = () => Promise.resolve({ data: null, error: null, ...(h.results[table] ?? {}) });
    b.single = settle;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => settle().then(res, rej);
    return b;
  };
  return { supabase: { from: builder, rpc: h.rpc, storage: { from: () => ({ upload: h.upload }) } } };
});
vi.mock("@/lib/file-utils", () => ({ resolveContentType: (f: File) => f.type || "image/png" }));

import {
  createPearl, deletePearl, getRandomPearl, listPearlLinkTargets, listPearls, updatePearl, uploadPearlImage,
} from "./pearls";

const row = { id: "1", message: "Merci", source: "mail", is_positive: true };

describe("services/pearls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.results = {};
    h.calls = [];
  });

  it("liste les perles avec mission et formation, liens absents ramenés à null", async () => {
    h.results.client_pearls = { data: [{ ...row, mission: { title: "M" } }, { ...row, id: "2", training: { training_name: "F" } }] };
    const res = await listPearls();
    expect(res[0]).toMatchObject({ id: "1", mission: { title: "M" }, training: null });
    expect(res[1]).toMatchObject({ id: "2", mission: null, training: { training_name: "F" } });
    expect(h.calls.find((c) => c.method === "select")!.args[0]).toContain("mission:missions(title)");
  });

  it("renvoie une liste vide quand la base ne renvoie rien", async () => {
    h.results.client_pearls = { data: null };
    expect(await listPearls()).toEqual([]);
  });

  it("propage les erreurs de la base", async () => {
    h.results.client_pearls = { error: new Error("rls") };
    await expect(listPearls()).rejects.toThrow("rls");
    await expect(createPearl({ message: "x" })).rejects.toThrow("rls");
    await expect(updatePearl("1", { title: "t" })).rejects.toThrow("rls");
    await expect(deletePearl("1")).rejects.toThrow("rls");
  });

  it("tire une perle au hasard en excluant celle affichée", async () => {
    h.rpc.mockResolvedValue({ data: [row], error: null });
    expect(await getRandomPearl("old")).toMatchObject({ id: "1" });
    expect(h.rpc).toHaveBeenCalledWith("get_random_client_pearl", { p_exclude: "old" });
    await getRandomPearl();
    expect(h.rpc).toHaveBeenLastCalledWith("get_random_client_pearl", { p_exclude: undefined });
  });

  it("renvoie null sans perle et lève l'erreur du tirage", async () => {
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect(await getRandomPearl()).toBeNull();
    h.rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(getRandomPearl()).rejects.toThrow("boom");
  });

  it("crée, modifie et supprime", async () => {
    h.results.client_pearls = { data: row };
    expect(await createPearl({ message: "Merci", source: "mail" })).toMatchObject({ id: "1" });
    expect(await updatePearl("1", { archived: true })).toMatchObject({ id: "1" });
    await deletePearl("1");
    expect(h.calls.map((c) => c.method)).toEqual(expect.arrayContaining(["insert", "update", "delete"]));
    expect(h.calls.find((c) => c.method === "eq")!.args).toEqual(["id", "1"]);
  });

  it("charge les missions et formations à relier", async () => {
    h.results.missions = { data: [{ id: "m", title: "Alpha" }] };
    h.results.trainings = { data: [{ id: "t", training_name: "F", start_date: null }] };
    expect(await listPearlLinkTargets()).toEqual({
      missions: [{ id: "m", title: "Alpha" }],
      trainings: [{ id: "t", training_name: "F", start_date: null }],
    });
    h.results.missions = { data: null };
    h.results.trainings = { data: null };
    expect(await listPearlLinkTargets()).toEqual({ missions: [], trainings: [] });
  });

  it("lève l'erreur d'une des deux listes", async () => {
    h.results.missions = { error: new Error("m") };
    await expect(listPearlLinkTargets()).rejects.toThrow("m");
    h.results.missions = { data: [] };
    h.results.trainings = { error: new Error("t") };
    await expect(listPearlLinkTargets()).rejects.toThrow("t");
  });

  it("envoie l'image dans le bucket privé sous un nom aléatoire", async () => {
    h.upload.mockResolvedValue({ error: null });
    const path = await uploadPearlImage(new File(["x"], "Capture.PNG", { type: "image/png" }));
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(h.upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: "image/png" });
    h.upload.mockResolvedValue({ error: new Error("quota") });
    await expect(uploadPearlImage(new File(["x"], "noext", { type: "image/webp" }))).rejects.toThrow("quota");
  });
});
