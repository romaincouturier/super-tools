import { afterEach, expect, it, vi } from "vitest";
vi.mock("./mod.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("./document-extract.ts", () => ({ extractDocument: vi.fn() }));
const { decode, crop } = vi.hoisted(() => ({ decode: vi.fn(), crop: vi.fn() }));
vi.mock('https://deno.land/x/imagescript@1.3.0/mod.ts', () => ({ Image: { decode } }));
const { readMediaImage } = await import("./mission-tools.ts");
const jpeg = Uint8Array.from([255,216,255,192,0,17,8,0,10,0,10,3,1,17,0,2,17,0,3,17,0,255,217]);
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])('accepte un identifiant book_productions, full_resolution=%s', async full => {
  const from = vi.fn((table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'media' ? null : { file_url: 'u/album/IMG_4093.jpg', thumbnail_url: null, file_type: 'image' }, error: null }) }) }) }));
  const signed = vi.fn(async () => ({ data: { signedUrl: 'https://signed.test/book' }, error: null }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } })));
  await readMediaImage({ from, storage: { from: () => ({ createSignedUrl: signed }) } } as any, 'c2ea89b2-70ab-431f-b564-56cd28aec1b3', full, async () => {});
  expect(from).toHaveBeenCalledWith('book_productions');
  expect(signed).toHaveBeenCalledWith('u/album/IMG_4093.jpg', 60, full ? undefined : { transform: { width: 1600, height: 1600, resize: 'contain', quality: 80 } });
});
it('utilise la vignette Book quand Storage refuse la résolution de l’original', async () => {
  const from = (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'media' ? null : { file_url: 'https://s.test/storage/v1/object/public/book-productions/original.jpg', thumbnail_url: 'u/thumbnail.jpg', file_type: 'image' }, error: null }) }) }) });
  const signed = vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('original') ? new Response(JSON.stringify({ message: 'The source image resolution is too large to process' }), { status: 400 }) : new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } })));
  await readMediaImage({ from, storage: { from: () => ({ createSignedUrl: signed }) } } as any, 'book', false, async () => {});
  expect(signed).toHaveBeenLastCalledWith('u/thumbnail.jpg', 60, { transform: { width: 1600, height: 1600, resize: 'contain', quality: 80 } });
});
it('ne masque pas un refus de la table media par une lecture Book', async () => {
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) }));
  await expect(readMediaImage({ from } as any, 'id', false, async () => {})).rejects.toThrow('permission denied');
  expect(from).toHaveBeenCalledTimes(1);
});
it('refuse une production vidéo', async () => {
  const from = (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'media' ? null : { file_type: 'video' }, error: null }) }) }) });
  await expect(readMediaImage({ from } as any, 'id', false, async () => {})).rejects.toThrow('pas une image');
});
it.each([false, true])('recadre une production Book sur sa version réduite, full_resolution=%s', async full => {
  const from = (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'media' ? null : { file_url: 'u/a/p.jpg', file_type: 'image' }, error: null }) }) }) });
  decode.mockResolvedValue({ width: 10, height: 10, crop, encodeJPEG: async () => jpeg });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } })));
  const signed = vi.fn(async () => ({ data: { signedUrl: 'https://signed.test/book' }, error: null }));
  await readMediaImage({ from, storage: { from: () => ({ createSignedUrl: signed }) } } as any, 'book', full, async () => {}, { x: 20, y: 10, width: 50, height: 50 });
  expect(crop).toHaveBeenCalledWith(2,1,5,5);
  expect(signed).toHaveBeenCalledWith('u/a/p.jpg',60,{ transform: { width:1600,height:1600,resize:'contain',quality:80 } });
});

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