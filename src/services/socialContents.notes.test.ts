import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as [string, unknown[]][], result: { data: null as unknown, error: null as unknown } }));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "insert", "update", "delete", "eq", "gte", "lte", "order", "single"]) {
    chain[m] = (...args: unknown[]) => { h.calls.push([m, args]); return chain; };
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(h.result).then(resolve, reject);
  return { supabase: chain };
});

import {
  createNote,
  deleteNote,
  listNotesInRange,
  NOTE_NOT_FOUND_MESSAGE,
  NOTE_TEXT_EMPTY_MESSAGE,
  NOTE_TEXT_MAX,
  NOTE_TEXT_TOO_LONG_MESSAGE,
  noteTextLength,
  updateNote,
} from "./socialContents";

const call = (name: string) => h.calls.filter(([m]) => m === name).map(([, args]) => args);

describe("service des notes du calendrier", () => {
  beforeEach(() => {
    h.calls = [];
    h.result = { data: [], error: null };
  });

  it("lit les notes des jours de la plage, bornes comprises, en clés de jour", async () => {
    await listNotesInRange("2026-10-26", "2026-12-06");
    expect(call("from")).toEqual([["social_calendar_notes"]]);
    expect(call("gte")).toEqual([["day", "2026-10-26"]]);
    expect(call("lte")).toEqual([["day", "2026-12-06"]]);
  });

  it("crée une note au texte retiré des blancs, couleur en minuscules", async () => {
    h.result = { data: { id: "n" }, error: null };
    await createNote({ day: "2026-11-12", text: "  Lancement AI4Product ", color: "#F97316" });
    expect(call("insert")).toEqual([[{ day: "2026-11-12", text: "Lancement AI4Product", color: "#f97316" }]]);
  });

  it("refuse un texte vide sans appeler la base", async () => {
    await expect(createNote({ day: "2026-11-12", text: "   ", color: "#f97316" })).rejects.toThrow(NOTE_TEXT_EMPTY_MESSAGE);
    await expect(updateNote("n", { text: "  " })).rejects.toThrow(NOTE_TEXT_EMPTY_MESSAGE);
    expect(h.calls).toEqual([]);
  });

  it("déplace une note en ne changeant que son jour", async () => {
    h.result = { data: [{ id: "n" }], error: null };
    await updateNote("n", { day: "2026-11-14" });
    expect(call("update")).toEqual([[{ day: "2026-11-14" }]]);
    expect(call("eq")).toEqual([["id", "n"]]);
  });

  it("signale une suppression ou une modification sans ligne touchée", async () => {
    await expect(deleteNote("n")).rejects.toThrow(NOTE_NOT_FOUND_MESSAGE);
    await expect(updateNote("n", { day: "2026-11-14" })).rejects.toThrow(NOTE_NOT_FOUND_MESSAGE);
  });

  it("supprime une note existante", async () => {
    h.result = { data: [{ id: "n" }], error: null };
    await expect(deleteNote("n")).resolves.toBeUndefined();
    expect(call("delete")).toHaveLength(1);
  });

  it("modifie une note avec un texte retiré des blancs et une couleur en minuscules", async () => {
    h.result = { data: [{ id: "n" }], error: null };
    await updateNote("n", { text: "  Relance  ", color: "#3B82F6" });
    expect(call("update")).toEqual([[{ text: "Relance", color: "#3b82f6" }]]);
  });

  it("rejette sur une erreur Supabase en lecture et en création", async () => {
    const err = { message: "permission denied", code: "42501" };
    h.result = { data: null, error: err };
    await expect(listNotesInRange("2026-10-26", "2026-12-06")).rejects.toBe(err);
    await expect(createNote({ day: "2026-11-12", text: "Idée", color: "#f97316" })).rejects.toBe(err);
  });

  it("compte la longueur en points de code : 500 emojis passent, 501 sont refusés sans appel", async () => {
    expect(noteTextLength("🚀🎉a")).toBe(3);
    h.result = { data: { id: "n" }, error: null };
    await createNote({ day: "2026-11-12", text: "🚀".repeat(NOTE_TEXT_MAX), color: "#f97316" });
    h.calls = [];
    await expect(createNote({ day: "2026-11-12", text: "🚀".repeat(NOTE_TEXT_MAX + 1), color: "#f97316" }))
      .rejects.toThrow(NOTE_TEXT_TOO_LONG_MESSAGE);
    expect(h.calls).toEqual([]);
  });
});
