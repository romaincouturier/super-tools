import { describe, expect, it, vi } from "vitest";
import { refreshRecentFireflies } from "../fireflies-backfill/refresh";

const meeting = (id: string) => ({ id, title: id, date: 1 });

describe("rafraîchissement Fireflies récent", () => {
  it("repart des 30 réunions récentes sans cutoff à chaque clic et récupère celle arrivée entre deux appels", async () => {
    const stored = new Map<string, { external_id: string; status: string; raw_text: string }>();
    const list = vi.fn().mockResolvedValueOnce([meeting("avant")]).mockResolvedValueOnce([meeting("hier"), meeting("avant")]);
    const read = async () => [...stored.values()];
    const imported: string[] = [];
    const save = async (id: string) => {
      imported.push(id);
      stored.set(id, { external_id: id, status: "ready", raw_text: "Texte" });
      return true;
    };
    expect(await refreshRecentFireflies(list, read, save)).toEqual({ total_listed: 1, newly_imported: 1, invalid_existing: 0 });
    expect(await refreshRecentFireflies(list, read, save)).toEqual({ total_listed: 2, newly_imported: 1, invalid_existing: 0 });
    expect(list.mock.calls).toEqual([[0, undefined, undefined, 30], [0, undefined, undefined, 30]]);
    expect(imported).toEqual(["avant", "hier"]);
    expect(stored.get("hier")?.raw_text).toBe("Texte");
  });

  it("importe toutes les absentes de la fenêtre récente, pas seulement trois", async () => {
    const meetings = Array.from({ length: 30 }, (_, index) => meeting(String(index)));
    const imported: string[] = [];
    const result = await refreshRecentFireflies(async () => meetings, async () => [], async (id) => { imported.push(id); return true; });
    expect(result.newly_imported).toBe(30);
    expect(imported).toEqual(meetings.map((m) => m.id));
  });

  it("préserve les corbeilles et les fiches invalides et ne duplique pas une réunion", async () => {
    const imported: string[] = [];
    const result = await refreshRecentFireflies(async () => [meeting("corbeille"), meeting("vide"), meeting("nouvelle"), meeting("nouvelle")], async () => [
      { external_id: "corbeille", status: "trashed", raw_text: "" },
      { external_id: "vide", status: "error", raw_text: "" },
    ], async (id) => { imported.push(id); return true; });
    expect(result).toEqual({ total_listed: 4, newly_imported: 1, invalid_existing: 1 });
    expect(imported).toEqual(["nouvelle"]);
  });

  it("remonte une panne d’import au lieu de déclarer un succès", async () => {
    await expect(refreshRecentFireflies(async () => [meeting("hier")], async () => [], async () => { throw new Error("Import Fireflies 429"); })).rejects.toThrow("Import Fireflies 429");
  });
});