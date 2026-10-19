import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { findDuplicateAudio, normalizeAudioSeconds, resolveAudioStatus } from "./lmsMediaImport";

const base = { file_url: "u", created_at: "2026-10-09T10:00:00Z" };

describe("audio LMS", () => {
  it("détecte un doublon par empreinte", () => {
    const e = [{ ...base, id: "a", file_name: "x.m4a", file_size: 10, content_hash: "h1", transcript: null }];
    expect(findDuplicateAudio(e, { name: "autre.m4a", size: 99 }, "h1")?.id).toBe("a");
    expect(findDuplicateAudio(e, { name: "x.m4a", size: 10 }, "h2")).toBeNull();
  });
  it("anciennes lignes sans empreinte : même nom et taille, copie transcrite préférée", () => {
    const e = [
      { ...base, id: "a", file_name: "x.m4a", file_size: 10, content_hash: null, transcript: null },
      { ...base, id: "b", file_name: "x.m4a", file_size: 10, content_hash: null, transcript: "texte" },
    ];
    expect(findDuplicateAudio(e, { name: "x.m4a", size: 10 }, "h")?.id).toBe("b");
  });
  it("normalise la durée", () => {
    expect(normalizeAudioSeconds(62.4)).toBe(62);
    expect(normalizeAudioSeconds(0)).toBeNull();
    expect(normalizeAudioSeconds(undefined)).toBeNull();
  });
  it("statut : blocs liés => traité, sinon transcrit / erreur / en attente", () => {
    expect(resolveAudioStatus({ transcript: "t", transcription_status: "transcribed", blocks_count: 2 })).toBe("processed");
    expect(resolveAudioStatus({ transcript: "t", transcription_status: "transcribed", blocks_count: 0 })).toBe("transcribed");
    expect(resolveAudioStatus({ transcript: null, transcription_status: "error", blocks_count: 0 })).toBe("error");
    expect(resolveAudioStatus({ transcript: null, transcription_status: null, blocks_count: 0 })).toBe("pending");
  });
});
