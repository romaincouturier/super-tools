import { describe, expect, it, vi } from "vitest";
import { uploadLmsImage } from "./useLmsUploads";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), register: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/useMedia", () => ({ registerMediaEntry: mocks.register, deleteMediaFile: vi.fn() }));

describe("uploads images LMS simultanés", () => {
  it("produit trois chemins distincts même lorsque les images arrivent à la même milliseconde", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const paths: string[] = [];
    mocks.invoke.mockImplementation(async (_name, { body }: { body: FormData }) => {
      const path = String(body.get("path"));
      paths.push(path);
      return { data: { publicUrl: path }, error: null };
    });
    mocks.register.mockResolvedValue(undefined);
    try {
      const urls = await Promise.all(["a.png", "b.png", "c.png"].map((name) => uploadLmsImage(new File([name], name, { type: "image/png" }), "lesson")));
      expect(new Set(paths).size).toBe(3);
      expect(urls).toEqual(paths);
      expect(paths.every((path) => path.startsWith("images/lesson/") && path.endsWith(".png"))).toBe(true);
      expect(mocks.register.mock.calls.map(([entry]) => entry.file_url)).toEqual(paths);
    } finally {
      vi.restoreAllMocks();
    }
  });
});