import { afterEach, expect, it, vi } from "vitest";
vi.mock("./mod.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("./document-extract.ts", () => ({ extractDocument: vi.fn() }));
const { readMediaImage } = await import("./mission-tools.ts");
afterEach(() => vi.unstubAllGlobals());

it.each(["object/public/", "object/authenticated/", "object/sign/", "object/", "render/image/public/", "render/image/authenticated/", "render/image/sign/"])("lit le bucket privé depuis une URL %s avec le SDK", async kind => {
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null }));
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([8, 9]), { headers: { "content-type": "image/jpeg" } })));
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: `https://example.test/storage/v1/${kind}book-productions/folder/mon%20image.jpeg?token=expired`, mime_type: "image/jpeg" }, error: null }) }) }) }),
    storage: { from: storageFrom },
  };
  const result = await readMediaImage(client as any, "e963d32f-1968-4e5a-a966-f077e81b208b", true, async () => {});
  expect(storageFrom).toHaveBeenCalledWith("book-productions");
  expect(createSignedUrl).toHaveBeenCalledWith("folder/mon image.jpeg", 60, undefined);
  expect(result).toEqual({ data: btoa(String.fromCharCode(8, 9)), mimeType: "image/jpeg" });
});

it("ne contourne pas un refus du stockage", async () => {
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: "https://example.test/storage/v1/object/public/book-productions/a.jpeg", mime_type: "image/jpeg" } }) }) }) }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "Access denied" } }) }) },
  };
  await expect(readMediaImage(client as any, "id", true, async () => {})).rejects.toThrow("Access denied");
});

it.each([false, true])("interrompt une image externe trop lourde avant décodage, full_resolution=%s", async full => {
  const max = full ? 5 * 1024 * 1024 : 512 * 1024;
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(max + 1)); }, cancel }), { headers: { "content-type": "image/jpeg" } });
  vi.stubGlobal("fetch", vi.fn(async () => response));
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: "https://media.test/board.jpeg", mime_type: "image/jpeg" } }) }) }) }) };
  await expect(readMediaImage(client as any, "id", full, async () => {})).rejects.toThrow(full ? "maximum 5 Mo" : "maximum 512 Kio");
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("refuse aussi un grand téléchargement externe avec crop en pleine résolution", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(512 * 1024 + 1), { headers: { "content-type": "image/jpeg" } })));
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { file_url: "https://media.test/board.jpeg", mime_type: "image/jpeg" } }) }) }) }) };
  await expect(readMediaImage(client as any, "id", true, async () => {}, { x: 0, y: 0, width: 50, height: 50 })).rejects.toThrow("maximum 512 Kio");
});