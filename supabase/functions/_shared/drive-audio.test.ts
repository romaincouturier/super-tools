import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

vi.mock("npm:mp4box@2.5.0", async () => await import("mp4box"));
import { extractDriveAudioPart } from "./drive-audio.ts";

describe("Drive AAC extraction", () => {
  it("bounds extraction to ten minutes and resumes after legacy 45-minute parts without a gap", async () => {
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "5405", "-c:a", "aac", "-y", "/tmp/drive-resume-test.mp4"]);
    const source = readFileSync("/tmp/drive-resume-test.mp4");
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const match = /bytes=(\d+)-(\d+)/.exec(options.headers.Range);
      if (!match) throw new Error("Missing range");
      return new Response(source.subarray(Number(match[1]), Number(match[2]) + 1), { status: 206 });
    }));
    try {
      const first = await extractDriveAudioPart("file", "test-token", source.length, 0, 0);
      expect(first.duration).toBeGreaterThanOrEqual(600);
      expect(first.duration).toBeLessThan(601);
      expect(first.totalParts).toBe(10);
      const resumed = await extractDriveAudioPart("file", "test-token", source.length, 2, 5400);
      expect(resumed.start).toBeCloseTo(5400, 1);
      expect(resumed.duration).toBeGreaterThanOrEqual(5);
      expect(resumed.duration).toBeLessThan(6);
      expect(resumed.totalParts).toBe(3);
      writeFileSync("/tmp/drive-resume-test.aac", resumed.bytes);
      const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", "/tmp/drive-resume-test.aac", "-f", "s16le", "-ac", "1", "-ar", "48000", "pipe:1"]);
      expect(decoded.length / (48000 * 2)).toBeGreaterThanOrEqual(5);
    } finally { vi.unstubAllGlobals(); }
  }, 60000);
  it("extracts decodable audio from MP4 with moov at end without downloading the whole video", async () => {
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=500:duration=5", "-c:a", "aac", "-y", "/tmp/drive-extraction-test.mp4"]);
    const source = readFileSync("/tmp/drive-extraction-test.mp4");
    const ranges: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const range = options.headers.Range as string;
      ranges.push(range);
      const match = /bytes=(\d+)-(\d+)/.exec(range);
      if (!match) throw new Error("Missing range");
      return new Response(source.subarray(Number(match[1]), Number(match[2]) + 1), { status: 206 });
    }));
    try {
      const part = await extractDriveAudioPart("file", "test-token", source.length, 0);
      expect(part.expected).toBeGreaterThanOrEqual(5);
      expect(part.duration).toBeGreaterThanOrEqual(5);
      expect(part.totalParts).toBe(1);
      expect(ranges.length).toBeGreaterThan(0);
      writeFileSync("/tmp/drive-extraction-test.aac", part.bytes);
      const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", "/tmp/drive-extraction-test.aac", "-f", "s16le", "-ac", "1", "-ar", "44100", "pipe:1"]);
      expect(decoded.length / (44100 * 2)).toBeGreaterThanOrEqual(5);
    } finally { vi.unstubAllGlobals(); }
  });
});