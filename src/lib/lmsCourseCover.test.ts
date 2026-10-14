import { beforeEach, describe, expect, it, vi } from "vitest";

const { upload, getPublicUrl, from } = vi.hoisted(() => ({
  upload: vi.fn(), getPublicUrl: vi.fn(), from: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from } } }));
import { COURSE_COVER_MAX_BYTES, uploadCourseCover, validateCourseCover } from "./lmsCourseCover";

describe("course covers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ upload, getPublicUrl });
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.org/cover.png" } });
  });
  it.each([["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["webp", "image/webp"], ["PNG", ""]])("accepts %s", (extension, type) => {
    expect(() => validateCourseCover(new File(["image"], `cover.${extension}`, { type }))).not.toThrow();
  });
  it.each([["gif", "image/gif"], ["svg", "image/svg+xml"], ["png", "text/html"]])("rejects %s / %s", (extension, type) => {
    expect(() => validateCourseCover(new File(["image"], `cover.${extension}`, { type }))).toThrow("Formats acceptés");
  });
  it("accepts the exact size limit and rejects larger files", () => {
    expect(() => validateCourseCover(new File([new Uint8Array(COURSE_COVER_MAX_BYTES)], "cover.png", { type: "image/png" }))).not.toThrow();
    expect(() => validateCourseCover(new File([new Uint8Array(COURSE_COVER_MAX_BYTES + 1)], "cover.png", { type: "image/png" }))).toThrow("5 Mo");
  });
  it("uploads to the LMS bucket with a unique course path and returns the public URL", async () => {
    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    await expect(uploadCourseCover(file, "course-id")).resolves.toBe("https://example.org/cover.png");
    expect(from).toHaveBeenCalledWith("lms-content");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^images\/course-id\/cover-.*\.webp$/), file, { contentType: "image/webp", upsert: false });
  });
  it("never uploads an invalid file", async () => {
    await expect(uploadCourseCover(new File(["gif"], "cover.gif", { type: "image/gif" }), "course-id")).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });
  it("propagates upload errors", async () => {
    upload.mockResolvedValue({ error: new Error("Accès refusé") });
    await expect(uploadCourseCover(new File(["image"], "cover.png", { type: "image/png" }), "course-id")).rejects.toThrow("Accès refusé");
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});