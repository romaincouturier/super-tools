import { describe, it, expect } from "vitest";
import { transcriptRecordedAt, TRANSCRIPT_ASSIGNMENT_CUTOFF } from "./daily-data-fetchers";

const cutoff = Date.parse(TRANSCRIPT_ASSIGNMENT_CUTOFF);
const isAlerted = (t: Parameters<typeof transcriptRecordedAt>[0]) => Date.parse(transcriptRecordedAt(t)) >= cutoff;

describe("Transcripts à affecter : date d'origine", () => {
  it("ignore une vidéo Loom enregistrée avant le 01/02/2026 même importée récemment", () => {
    expect(isAlerted({ created_at: "2026-11-03T10:00:00Z", metadata: { loom_created_at: "2025-12-26T16:39:37Z" } })).toBe(false);
  });
  it("ignore une réunion Fireflies antérieure au 01/02/2026", () => {
    expect(isAlerted({ created_at: "2026-11-03T10:00:00Z", metadata: { fireflies_date: "2026-01-31T10:00:00Z" } })).toBe(false);
  });
  it("garde un enregistrement du 01/02/2026", () => {
    expect(isAlerted({ created_at: "2026-11-03T10:00:00Z", metadata: { loom_created_at: "2026-02-01T08:00:00Z" } })).toBe(true);
  });
  it("utilise la date d'import sans date d'origine", () => {
    expect(isAlerted({ created_at: "2026-10-20T10:00:00Z", metadata: {} })).toBe(true);
  });
});
