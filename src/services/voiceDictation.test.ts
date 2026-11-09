import { describe, expect, it, vi } from "vitest";
import { waitForDictation } from "./voiceDictation";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("suivi de la dictée", () => {
  it("conserve le même identifiant et attend le texte après plus de deux minutes", async () => {
    let polls = 0;
    const invoke = vi.fn(async (body) => body.mode === "submit" ? { transcript_id: "audio-1" } :
      ++polls < 50 ? { status: "processing" } : { status: "completed", transcript: "Début et fin de la note", audio_duration: 350 });
    const saveId = vi.fn(async () => {});
    expect(await waitForDictation("audio", "audio/webm", invoke, saveId, async () => {})).toEqual({ text: "Début et fin de la note", duration: 350 });
    expect(saveId).toHaveBeenCalledWith("audio-1");
    expect(invoke.mock.calls.slice(1).every(([body]) => body.transcript_id === "audio-1")).toBe(true);
    expect(invoke.mock.calls.filter(([body]) => body.mode === "submit")).toHaveLength(1);
  });
  it("ne transforme pas une erreur fournisseur en succès vide", async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ transcript_id: "audio-1" }).mockResolvedValueOnce({ status: "error", error: "audio corrompu" });
    await expect(waitForDictation("audio", "audio/webm", invoke, undefined, async () => {})).rejects.toThrow("audio corrompu");
  });
  it("signale une transcription sans parole", async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ transcript_id: "audio-1" }).mockResolvedValueOnce({ status: "completed", transcript: "" });
    await expect(waitForDictation("audio", "audio/webm", invoke, undefined, async () => {})).rejects.toThrow("Aucune parole");
  });
});