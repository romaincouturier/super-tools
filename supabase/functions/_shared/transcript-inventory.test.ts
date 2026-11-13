import { describe, expect, it, vi, afterEach } from "vitest";
import { classifyInventoryItem, canRepairInventoryItem, firefliesText, inventorySummary, transcriptHash } from "./transcript-inventory";
import { firefliesInitialStatus } from "./transcript-repair";
import { listFirefliesPage } from "./fireflies-client";

const text = "Romain: Nous abordons ensemble la facilitation graphique et les apprentissages collectifs pour cette réunion professionnelle.";
const row = { id: "id", external_id: "external", status: "ready", raw_text: text, updated_at: new Date().toISOString(), duration_seconds: 600, metadata: {} };
const item = { external_id: "external", title: "Réunion" };
afterEach(() => vi.unstubAllGlobals());

describe("Contrôle d’exhaustivité", () => {
  it("une fiche vide n’est jamais certifiée complète", async () => {
    expect((await classifyInventoryItem("fireflies", item, { ...row, raw_text: "" })).state).toBe("empty");
    expect(firefliesInitialStatus("", false).status).toBe("error");
  });
  it("un résumé seul n’est pas un transcript intégral", async () => {
    expect(firefliesInitialStatus(text, false)).toEqual(expect.objectContaining({ status: "error", text_origin: "summary" }));
    expect((await classifyInventoryItem("fireflies", item, { ...row, metadata: { text_origin: "summary" } })).state).toBe("summary_only");
  });
  it("préserve les corbeilles même sans texte", async () => {
    const trashed = { ...row, status: "trashed", raw_text: "" };
    expect((await classifyInventoryItem("fireflies", item, trashed)).state).toBe("trashed");
    expect(canRepairInventoryItem({ ...item, state: "missing" }, trashed)).toBe(false);
  });
  it("ne répare pas un traitement actif", () => {
    expect(canRepairInventoryItem({ ...item, state: "error" }, { ...row, status: "processing" })).toBe(false);
  });
  it("compare concrètement les phrases de la source", async () => {
    const verified = { ...item, checked: true, source_sentences: 1, source_hash: await transcriptHash(text) };
    expect((await classifyInventoryItem("fireflies", verified, row)).state).toBe("complete");
    expect((await classifyInventoryItem("fireflies", verified, { ...row, raw_text: `${text} Phrase ajoutée.` })).state).toBe("mismatch");
  });
  it("ne certifie pas une durée absente ou tronquée", async () => {
    expect((await classifyInventoryItem("google_drive", item, row)).state).toBe("unverified");
    expect((await classifyInventoryItem("google_drive", { ...item, source_duration: 3600 }, row)).state).toBe("mismatch");
  });
  it("refuse un morceau manquant", async () => {
    const metadata = { audio_total_parts: 2, audio_parts: [{ index: 0, start: 0, duration: 600, actual_duration: 600, text, job_id: "a" }] };
    expect((await classifyInventoryItem("google_drive", { ...item, source_duration: 600 }, { ...row, metadata })).state).toBe("mismatch");
  });
  it("compte les absents sans confondre les corbeilles", () => {
    expect(inventorySummary([{ ...item, state: "missing" }, { ...item, state: "trashed" }])).toEqual({ total: 2, missing: 1, trashed: 1 });
  });
  it("conserve les phrases dans l’ordre", () => {
    expect(firefliesText({ sentences: [{ speaker_name: "A", text: "Première" }, { speaker_name: "B", text: "Deuxième" }] })).toBe("A: Première\nB: Deuxième");
  });
  it("pagination au-delà de 30 avec dates identiques sans reculer la date", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "test" } });
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ data: { transcripts: Array.from({ length: body.variables.skip ? 1 : 50 }, (_, i) => ({ id: String(body.variables.skip + i), title: "Même date", date: 1 })) } }));
    });
    vi.stubGlobal("fetch", fetcher);
    const first = await listFirefliesPage(0, "2026-11-13T00:00:00Z");
    const next = await listFirefliesPage(first.length, "2026-11-13T00:00:00Z");
    expect(next[0].id).toBe("50");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1].body)).variables).toEqual({ limit: 50, skip: 50, toDate: "2026-11-13T00:00:00Z" });
  });
  it.each([429, 500])("ne transforme pas HTTP %s en inventaire vide", async (status) => {
    vi.stubGlobal("Deno", { env: { get: () => "test" } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota ou panne", { status })));
    await expect(listFirefliesPage(0)).rejects.toThrow(`Fireflies ${status}`);
  });
  it("ne transforme pas une erreur GraphQL en succès", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "test" } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Accès refusé" }] }))));
    await expect(listFirefliesPage(0)).rejects.toThrow("Accès refusé");
  });
});