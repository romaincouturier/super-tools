import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

vi.mock("npm:mp4box@2.5.0", async () => await import("mp4box"));
import { extractDriveAudioPart } from "./drive-audio.ts";

describe("Drive AAC extraction", () => {
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
      const result = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", "/tmp/drive-extraction-test.aac"], { encoding: "utf8" });
      expect(Number(JSON.parse(result).format.duration)).toBeGreaterThanOrEqual(5);
    } finally { vi.unstubAllGlobals(); }
  });
});