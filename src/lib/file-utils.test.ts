import { describe, it, expect } from "vitest";
import { formatFileSize, sanitizeFileName, buildStoragePath, extractStoragePath, resolveContentType, getFileType } from "./file-utils";

// ── formatFileSize ───────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatFileSize(null)).toBe("");
    expect(formatFileSize(undefined)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 octets");
    expect(formatFileSize(512)).toBe("512 octets");
    expect(formatFileSize(1023)).toBe("1023 octets");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 Ko");
    expect(formatFileSize(1536)).toBe("1.5 Ko");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 Ko");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 Mo");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 Mo");
    expect(formatFileSize(20 * 1024 * 1024)).toBe("20.0 Mo");
  });
});

// ── sanitizeFileName ─────────────────────────────────────────────────

describe("sanitizeFileName", () => {
  it("strips accents", () => {
    expect(sanitizeFileName("café.pdf")).toBe("cafe.pdf");
    expect(sanitizeFileName("résumé_été.docx")).toBe("resume_ete.docx");
  });

  it("replaces special characters with underscores", () => {
    expect(sanitizeFileName("file (1).pdf")).toBe("file__1_.pdf");
    expect(sanitizeFileName("hello world!.txt")).toBe("hello_world_.txt");
  });

  it("lowercases everything", () => {
    expect(sanitizeFileName("MyFile.PDF")).toBe("myfile.pdf");
  });

  it("preserves dots, dashes, underscores", () => {
    expect(sanitizeFileName("my-file_v2.0.tar.gz")).toBe("my-file_v2.0.tar.gz");
  });

  it("handles empty string", () => {
    expect(sanitizeFileName("")).toBe("");
  });
});

// ── buildStoragePath ─────────────────────────────────────────────────

describe("buildStoragePath", () => {
  it("builds a path with sanitized filename", () => {
    const path = buildStoragePath("mission", "abc-123", "Mon Fichier.pdf");
    // Format: mission/abc-123/{timestamp}_mon_fichier.pdf
    expect(path).toMatch(/^mission\/abc-123\/\d+_mon_fichier\.pdf$/);
  });

  it("handles accented filenames", () => {
    const path = buildStoragePath("training", "xyz", "Résumé été.docx");
    expect(path).toMatch(/^training\/xyz\/\d+_resume_ete\.docx$/);
  });
});

// ── extractStoragePath ───────────────────────────────────────────────

describe("extractStoragePath", () => {
  it("extracts path from public URL", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/mission-documents/abc/docs/123_file.pdf";
    expect(extractStoragePath(url, "mission-documents")).toBe("abc/docs/123_file.pdf");
  });

  it("returns null when bucket not found in URL", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/other-bucket/file.pdf";
    expect(extractStoragePath(url, "mission-documents")).toBeNull();
  });

  it("decodes URL-encoded characters", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/media/mission/abc/123_hello%20world.pdf";
    expect(extractStoragePath(url, "media")).toBe("mission/abc/123_hello world.pdf");
  });
});

// ── resolveContentType ───────────────────────────────────────────────

describe("resolveContentType", () => {
  it("returns file.type when present", () => {
    const file = new File([""], "photo.png", { type: "image/png" });
    expect(resolveContentType(file)).toBe("image/png");
  });

  it("falls back to extension when file.type is empty", () => {
    const file = new File([""], "icon.svg");
    // File constructor without type yields empty string
    Object.defineProperty(file, "type", { value: "" });
    expect(resolveContentType(file)).toBe("image/svg+xml");
  });

  it("returns application/octet-stream for unknown extensions", () => {
    const file = new File([""], "data.xyz");
    Object.defineProperty(file, "type", { value: "" });
    expect(resolveContentType(file)).toBe("application/octet-stream");
  });

  it("handles video extensions", () => {
    const file = new File([""], "clip.mp4");
    Object.defineProperty(file, "type", { value: "" });
    expect(resolveContentType(file)).toBe("video/mp4");
  });
  it("normalizes non-standard iOS MIME type audio/x-m4a", () => {
    const file = new File([""], "memo.m4a", { type: "audio/x-m4a" });
    expect(resolveContentType(file)).toBe("audio/mp4");
  });

  it("normalizes MIME type with optional parameters", () => {
    const file = new File([""], "memo.m4a", { type: "audio/x-m4a; charset=binary" });
    expect(resolveContentType(file)).toBe("audio/mp4");
  });
});

// ── getFileType ──────────────────────────────────────────────────────

describe("getFileType", () => {
  it("returns 'image' for image files", () => {
    const file = new File([""], "photo.jpg", { type: "image/jpeg" });
    expect(getFileType(file)).toBe("image");
  });

  it("returns 'video' for video files", () => {
    const file = new File([""], "clip.mp4", { type: "video/mp4" });
    expect(getFileType(file)).toBe("video");
  });

  it("returns null for non-media files", () => {
    const file = new File([""], "doc.pdf", { type: "application/pdf" });
    expect(getFileType(file)).toBeNull();
  });

  it("returns 'audio' for audio files", () => {
    const file = new File([""], "recording.mp3", { type: "audio/mpeg" });
    expect(getFileType(file)).toBe("audio");
  });

  it("falls back to extension for SVG with empty type", () => {
    const file = new File([""], "icon.svg");
    Object.defineProperty(file, "type", { value: "" });
    expect(getFileType(file)).toBe("image");
  });
});
