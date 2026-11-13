import { expect, it, vi } from "vitest";
vi.mock("./mod.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("./document-extract.ts", () => ({ extractDocument: vi.fn() }));
const { readMediaImage } = await import("./mission-tools.ts");

it.each(["public", "authenticated", "sign"])("lit le bucket privé depuis une URL %s avec le SDK", async kind => {
  const download = vi.fn(async () => ({ data: new Blob([new Uint8Array([8, 9])]), error: null }));
  const storageFrom = vi.fn(() => ({ download }));
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: `https://example.test/storage/v1/object/${kind}/book-productions/folder/mon%20image.jpeg?token=expired`, mime_type: "image/jpeg" }, error: null }) }) }) }),
    storage: { from: storageFrom },
  };
  const result = await readMediaImage(client as any, "e963d32f-1968-4e5a-a966-f077e81b208b", true, async () => {});
  expect(storageFrom).toHaveBeenCalledWith("book-productions");
  expect(download).toHaveBeenCalledWith("folder/mon image.jpeg");
  expect(result).toEqual({ data: btoa(String.fromCharCode(8, 9)), mimeType: "image/jpeg" });
});

it("ne contourne pas un refus du stockage", async () => {
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: "https://example.test/storage/v1/object/public/book-productions/a.jpeg", mime_type: "image/jpeg" } }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: "Access denied" } }) }) },
  };
  await expect(readMediaImage(client as any, "id", true, async () => {})).rejects.toThrow("Access denied");
});