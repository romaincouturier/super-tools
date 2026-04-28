import { describe, it, expect } from "vitest";
import {
  DEFAULT_DEPOSIT_FORMATS,
  DEFAULT_DEPOSIT_MAX_SIZE_MB,
  DEFAULT_WORK_DEPOSIT_CONFIG,
  isFileFormatAllowed,
  withDepositDefaults,
  type DepositFormat,
} from "./lms-work-deposit";

describe("withDepositDefaults", () => {
  it("returns the full default config when given null", () => {
    expect(withDepositDefaults(null)).toEqual(DEFAULT_WORK_DEPOSIT_CONFIG);
  });

  it("returns the full default config when given undefined", () => {
    expect(withDepositDefaults(undefined)).toEqual(DEFAULT_WORK_DEPOSIT_CONFIG);
  });

  it("returns the full default config when given an empty object", () => {
    expect(withDepositDefaults({})).toEqual(DEFAULT_WORK_DEPOSIT_CONFIG);
  });

  it("merges partial config over the defaults without losing other fields", () => {
    const result = withDepositDefaults({ title: "Mon dépôt", max_size_mb: 10 });
    expect(result.title).toBe("Mon dépôt");
    expect(result.max_size_mb).toBe(10);
    expect(result.accepted_formats).toEqual(DEFAULT_DEPOSIT_FORMATS);
    expect(result.sharing_allowed).toBe(true);
    expect(result.comments_enabled).toBe(true);
    expect(result.feedback_enabled).toBe(true);
  });

  it("respects an explicit false on boolean flags", () => {
    const result = withDepositDefaults({
      sharing_allowed: false,
      comments_enabled: false,
      feedback_enabled: false,
    });
    expect(result.sharing_allowed).toBe(false);
    expect(result.comments_enabled).toBe(false);
    expect(result.feedback_enabled).toBe(false);
  });

  it("default max_size_mb matches the documented constant", () => {
    expect(DEFAULT_WORK_DEPOSIT_CONFIG.max_size_mb).toBe(DEFAULT_DEPOSIT_MAX_SIZE_MB);
  });
});

describe("isFileFormatAllowed", () => {
  const allFormats: DepositFormat[] = ["jpg", "png", "pdf", "video"];

  it("accepts a JPEG when jpg is allowed", () => {
    expect(isFileFormatAllowed("image/jpeg", ["jpg"])).toBe(true);
  });

  it("accepts a PNG when png is allowed", () => {
    expect(isFileFormatAllowed("image/png", ["png"])).toBe(true);
  });

  it("accepts a PDF when pdf is allowed", () => {
    expect(isFileFormatAllowed("application/pdf", ["pdf"])).toBe(true);
  });

  it("accepts any video subtype when video is allowed (wildcard handling)", () => {
    expect(isFileFormatAllowed("video/mp4", ["video"])).toBe(true);
    expect(isFileFormatAllowed("video/webm", ["video"])).toBe(true);
    expect(isFileFormatAllowed("video/quicktime", ["video"])).toBe(true);
  });

  it("rejects a JPEG when jpg is not in the allowed list", () => {
    expect(isFileFormatAllowed("image/jpeg", ["png", "pdf"])).toBe(false);
  });

  it("rejects a PNG when only jpg is allowed (similar prefixes do not collide)", () => {
    expect(isFileFormatAllowed("image/png", ["jpg"])).toBe(false);
  });

  it("rejects a video when only image formats are allowed", () => {
    expect(isFileFormatAllowed("video/mp4", ["jpg", "png"])).toBe(false);
  });

  it("rejects unrelated mime types like text/plain", () => {
    expect(isFileFormatAllowed("text/plain", allFormats)).toBe(false);
    expect(isFileFormatAllowed("application/zip", allFormats)).toBe(false);
  });

  it("returns false on an empty allowlist", () => {
    expect(isFileFormatAllowed("image/jpeg", [])).toBe(false);
  });
});
