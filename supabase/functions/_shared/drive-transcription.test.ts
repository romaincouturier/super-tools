import { describe, expect, it } from "vitest";
import { adtsHeader, assembleAudioParts, assertCompleteDuration, discoverDriveVideos, canResumeDrive, newestDriveFirst, completedAudioPrefix } from "./drive-transcription.ts";

describe("Drive Meet transcription", () => {
  it("prioritizes the Savencia recording from November 23 over the historical backlog without mutating it", () => {
    const files = [{ id: "old", createdTime: "2026-01-20T10:00:00Z" }, { id: "savencia", createdTime: "2026-11-23T17:56:19Z" }, { id: "edhec", createdTime: "2026-11-13T15:02:00Z" }];
    expect(newestDriveFirst(files).slice(0, 2).map((f) => f.id)).toEqual(["savencia", "edhec"]);
    expect(files[0].id).toBe("old");
  });
  it("resumes only stalled Drive rows without a provider job, never ready or trashed rows", () => {
    const now = Date.parse("2026-11-23T18:00:00Z");
    const row = { status: "processing", assemblyai_id: null, updated_at: "2026-11-23T17:00:00Z" };
    expect(canResumeDrive(row, now)).toBe(true);
    expect(canResumeDrive({ ...row, status: "error" }, now)).toBe(true);
    expect(canResumeDrive({ ...row, status: "error", updated_at: "2026-11-23T18:09:00Z" }, now)).toBe(true);
    expect(canResumeDrive({ ...row, assemblyai_id: "active" }, now)).toBe(false);
    expect(canResumeDrive({ ...row, status: "ready" }, now)).toBe(false);
    expect(canResumeDrive({ ...row, status: "trashed" }, now)).toBe(false);
    expect(canResumeDrive({ ...row, updated_at: "2026-11-23T17:55:00Z" }, now)).toBe(false);
  });
  it("preserves completed legacy parts and retries only the unfinished suffix", () => {
    const completed = [0, 1].map((index) => ({ index, start: index * 2700, duration: 2700, actual_duration: 2700, text: `saved ${index}`, job_id: `j${index}` }));
    const pending = { index: 2, start: 5400, duration: 2700, job_id: "lost" };
    expect(completedAudioPrefix([...completed, pending])).toEqual(completed);
    expect(() => completedAudioPrefix([completed[1]])).toThrow("manque");
  });
  it("finds old videos recursively through every page and deduplicates Drive IDs", async () => {
    const video = { id: "old", mimeType: "video/mp4" };
    const files = await discoverDriveVideos(["legacy", "meet"], async (folder, page) => {
      if (folder === "legacy") return { files: [video], nextPageToken: page ? undefined : "second" };
      if (folder === "meet") return { files: [{ id: "meeting", mimeType: "application/vnd.google-apps.folder" }] };
      return { files: [video, { id: "nested", mimeType: "video/mp4" }, { id: "notes", mimeType: "application/vnd.google-apps.document" }, { id: "meet", mimeType: "application/vnd.google-apps.folder" }] };
    });
    expect(files.map((f) => f.id)).toEqual(["old", "nested"]);
  });
  it("reassembles all 3h30 in order, irrespective of completion order", () => {
    const parts = [0, 1, 2, 3, 4].map((index) => ({ index, start: index * 2700, duration: index === 4 ? 1800 : 2700, actual_duration: index === 4 ? 1800 : 2700, text: `part ${index}`, job_id: `${index}` }));
    expect(assembleAudioParts(parts.reverse(), 12600)).toEqual({ text: "part 0\n\npart 1\n\npart 2\n\npart 3\n\npart 4", duration: 12600 });
  });
  it("rejects a truncated 3h30 recording", () => {
    expect(() => assertCompleteDuration(12600, 7200)).toThrow("incomplète");
  });
  it("rejects a missing chunk", () => {
    expect(() => assembleAudioParts([{ index: 1, start: 2700, duration: 2700, actual_duration: 2700, text: "end", job_id: "j" }], 5400)).toThrow("manque");
  });
  it("builds valid AAC frame sizes", () => {
    const header = adtsHeader(400, 48000, 2);
    expect(((header[3] & 3) << 11) | (header[4] << 3) | (header[5] >> 5)).toBe(407);
    expect((header[2] >> 2) & 15).toBe(3);
  });
});
import { stalledTranscriptAction } from "./drive-transcription";
describe("stalledTranscriptAction", () => {
  it("reprend automatiquement trois fois puis passe en erreur", () => {
    expect(stalledTranscriptAction({})).toEqual({ action: "resume", resumes: 1 });
    expect(stalledTranscriptAction({ stall_resumes: 2 })).toEqual({ action: "resume", resumes: 3 });
    expect(stalledTranscriptAction({ stall_resumes: 3 })).toEqual({ action: "fail", resumes: 3 });
  });
});
