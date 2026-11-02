import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { COURSE_COVER_MAX_BYTES, uploadCourseCover, validateCourseCover } from "./lmsCourseCover";

describe("course covers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue({ data: { publicUrl: "https://example.org/cover.png" }, error: null });
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
  it("uploads through the upload-lms-content edge function with a unique course path", async () => {
    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    await expect(uploadCourseCover(file, "course-id")).resolves.toBe("https://example.org/cover.png");
    expect(invoke).toHaveBeenCalledWith("upload-lms-content", { body: expect.any(FormData) });
    const body = invoke.mock.calls[0][1].body as FormData;
    expect(body.get("path")).toMatch(/^images\/course-id\/cover-.*\.webp$/);
    expect(body.get("file")).toBeInstanceOf(File);
  });
  it("never uploads an invalid file", async () => {
    await expect(uploadCourseCover(new File(["gif"], "cover.gif", { type: "image/gif" }), "course-id")).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it("propagates upload errors", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Accès refusé") });
    await expect(uploadCourseCover(new File(["image"], "cover.png", { type: "image/png" }), "course-id")).rejects.toThrow("Accès refusé");
  });
});