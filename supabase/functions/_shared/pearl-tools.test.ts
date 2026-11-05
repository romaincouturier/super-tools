import { describe, expect, it, vi } from "vitest";
import { addPearl, archivePearl, listPearls, updatePearl, validatePearlField, type PearlDb } from "./pearl-tools";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

/** Constructeur de requête enchaînable, résolu avec `result` quand on l'attend. */
function query(result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const calls: Array<[string, unknown[]]> = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "eq", "or", "insert", "update"]) {
    q[m] = (...a: unknown[]) => { calls.push([m, a]); return q; };
  }
  q.single = () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  q.maybeSingle = () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(res);
  return { q, calls };
}

function dbWith(...queries: Array<ReturnType<typeof query>>): PearlDb & { rpc: ReturnType<typeof vi.fn> } {
  let i = 0;
  return { from: () => queries[i++].q, rpc: vi.fn() } as unknown as PearlDb & { rpc: ReturnType<typeof vi.fn> };
}

describe("validatePearlField", () => {
  it("accepte null et les valeurs valides", () => {
    expect(validatePearlField("mission_id", null)).toBeNull();
    expect(validatePearlField("source", "mail")).toBeNull();
    expect(validatePearlField("pearl_date", "2026-11-05")).toBeNull();
    expect(validatePearlField("pearl_time", "08:34")).toBeNull();
    expect(validatePearlField("is_positive", false)).toBeNull();
    expect(validatePearlField("mission_id", UUID)).toBeNull();
  });

  it("refuse les valeurs mal formées", () => {
    expect(validatePearlField("source", "facebook")).toMatch(/source must be one of/);
    expect(validatePearlField("pearl_date", "05/11/2026")).toBe("pearl_date must be YYYY-MM-DD");
    expect(validatePearlField("pearl_time", "8h34")).toBe("pearl_time must be HH:MM");
    expect(validatePearlField("mission_id", "pas-un-uuid")).toBe("mission_id must be a UUID");
    expect(validatePearlField("is_positive", "oui")).toBe("is_positive must be a boolean");
    expect(validatePearlField("title", 12)).toBe("title must be a string");
  });
});

describe("listPearls", () => {
  it("appelle le tirage au hasard en base quand random est vrai", async () => {
    const db = dbWith();
    db.rpc.mockResolvedValue({ data: [{ id: "p" }], error: null });
    expect(await listPearls(db, { random: true })).toEqual({ data: [{ id: "p" }] });
    expect(db.rpc).toHaveBeenCalledWith("get_random_client_pearl", { p_exclude: null });
  });

  it("renvoie l'erreur du tirage au hasard", async () => {
    const db = dbWith();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listPearls(db, { random: true })).toEqual({ error: "Error: boom" });
  });

  it("exclut les archivées par défaut et applique les filtres", async () => {
    const qr = query({ data: [] });
    await listPearls(dbWith(qr), { source: "mail", positive: false, mission_id: UUID, training_id: UUID });
    expect(qr.calls).toEqual(expect.arrayContaining([
      ["eq", ["archived", false]], ["eq", ["source", "mail"]], ["eq", ["is_positive", false]],
      ["eq", ["mission_id", UUID]], ["eq", ["training_id", UUID]],
    ]));
  });

  it("garde les archivées sur demande et neutralise les caractères de la recherche", async () => {
    const qr = query({ data: [] });
    await listPearls(dbWith(qr), { include_archived: true, search: "  a,b(c)%  " });
    expect(qr.calls.some(([m, a]) => m === "eq" && a[0] === "archived")).toBe(false);
    const filter = qr.calls.find(([m]) => m === "or")![1][0] as string;
    const clauses = filter.split(",");
    expect(clauses.map((c) => c.split(".")[0])).toEqual(["message", "message_fr", "title", "author_name", "author_company"]);
    expect(clauses[0]).toBe("message.ilike.%a b c  %");
  });

  it("renvoie l'erreur de la requête", async () => {
    expect(await listPearls(dbWith(query({ error: { message: "nope" } })), {})).toEqual({ error: "Error: nope" });
  });
});

describe("addPearl", () => {
  it("exige un message non vide", async () => {
    expect(await addPearl(dbWith(), { message: "   " })).toEqual({ error: "message is required" });
    expect(await addPearl(dbWith(), { message: 42 })).toEqual({ error: "message is required" });
  });

  it("n'insère que les champs connus, vides ignorés", async () => {
    const qr = query({ data: { id: "new" } });
    const res = await addPearl(dbWith(qr), { message: " Bravo ", title: "", is_positive: false, mission_id: UUID, inconnu: "x" });
    expect(res).toEqual({ data: { id: "new" } });
    expect(qr.calls.find(([m]) => m === "insert")![1][0]).toEqual({ message: "Bravo", is_positive: false, mission_id: UUID });
  });

  it("refuse un champ invalide avant tout appel à la base", async () => {
    const from = vi.fn();
    const res = await addPearl({ from, rpc: vi.fn() } as unknown as PearlDb, { message: "Bravo", source: "facebook" });
    expect(res).toMatchObject({ error: expect.stringContaining("source must be one of") });
    expect(from).not.toHaveBeenCalled();
  });

  it("signale un doublon de fil Gmail", async () => {
    const res = await addPearl(dbWith(query({ error: { message: "dup", code: "23505" } })), { message: "Bravo", gmail_thread_id: "t1" });
    expect(res).toEqual({ error: "Pearl already stored for this gmail_thread_id" });
  });

  it("renvoie les autres erreurs de la base", async () => {
    expect(await addPearl(dbWith(query({ error: { message: "oups", code: "XX" } })), { message: "Bravo" })).toEqual({ error: "Error: oups" });
  });
});

describe("updatePearl", () => {
  it("échoue si la perle n'existe pas", async () => {
    expect(await updatePearl(dbWith(query({ data: null })), { id: UUID, title: "t" })).toEqual({ error: "Pearl not found" });
  });

  it("refuse un message vide, une valeur invalide et une mise à jour sans champ", async () => {
    const found = () => query({ data: { id: UUID } });
    expect(await updatePearl(dbWith(found()), { id: UUID, message: "" })).toEqual({ error: "message cannot be empty" });
    expect(await updatePearl(dbWith(found()), { id: UUID, pearl_date: "demain" })).toEqual({ error: "pearl_date must be YYYY-MM-DD" });
    expect(await updatePearl(dbWith(found()), { id: UUID })).toEqual({ error: "Nothing to update" });
  });

  it("détache une mission avec une chaîne vide et renvoie avant et après", async () => {
    const before = query({ data: { id: UUID, mission_id: UUID } });
    const after = query({ data: { id: UUID, mission_id: null } });
    const res = await updatePearl(dbWith(before, after), { id: UUID, mission_id: "" });
    expect(after.calls.find(([m]) => m === "update")![1][0]).toEqual({ mission_id: null });
    expect(res).toEqual({ data: { before: { id: UUID, mission_id: UUID }, after: { id: UUID, mission_id: null } } });
  });

  it("renvoie l'erreur d'écriture", async () => {
    const res = await updatePearl(dbWith(query({ data: { id: UUID } }), query({ error: { message: "ko" } })), { id: UUID, title: "t" });
    expect(res).toEqual({ error: "Error: ko" });
  });
});

describe("archivePearl", () => {
  it("archive par défaut et désarchive avec archived=false", async () => {
    const a = query({ data: { id: UUID, archived: true } });
    expect(await archivePearl(dbWith(a), { id: UUID })).toEqual({ data: { id: UUID, archived: true } });
    expect(a.calls.find(([m]) => m === "update")![1][0]).toEqual({ archived: true });
    const b = query({ data: { id: UUID, archived: false } });
    await archivePearl(dbWith(b), { id: UUID, archived: false });
    expect(b.calls.find(([m]) => m === "update")![1][0]).toEqual({ archived: false });
  });

  it("signale une perle introuvable ou une erreur", async () => {
    expect(await archivePearl(dbWith(query({ data: null })), { id: UUID })).toEqual({ error: "Pearl not found" });
    expect(await archivePearl(dbWith(query({ error: { message: "x" } })), { id: UUID })).toEqual({ error: "Error: x" });
  });
});
