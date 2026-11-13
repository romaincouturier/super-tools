import { describe, expect, it } from "vitest";
import { adtsHeader, assembleAudioParts, assertCompleteDuration, discoverDriveVideos } from "./drive-transcription.ts";

describe("Drive Meet transcription", () => {
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