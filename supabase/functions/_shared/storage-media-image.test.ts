import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageDimensions, prepareStorageMediaImage, prepareMediaImage, STORAGE_IMAGE_TRANSFORM } from "./media-image.ts";

const { decode, crop, encodeJPEG } = vi.hoisted(() => ({ decode: vi.fn(), crop: vi.fn(), encodeJPEG: vi.fn() }));
vi.mock("https://deno.land/x/imagescript@1.3.0/mod.ts", () => ({ Image: { decode } }));

function jpeg(width = 1600, height = 800) {
  return new Uint8Array([255, 216, 255, 192, 0, 8, 8, height >> 8, height & 255, width >> 8, width & 255, 0]);
}
const zone = { x: 25, y: 10, width: 50, height: 40 };

beforeEach(() => {
  vi.clearAllMocks();
  decode.mockResolvedValue({ width: 1600, height: 800, crop, encodeJPEG });
  encodeJPEG.mockResolvedValue(jpeg(800, 320));
});
afterEach(() => vi.unstubAllGlobals());

describe("planches privées transformées par Storage", () => {
  it("ne télécharge ni ne décode l’original pour un aperçu", async () => {
    const signed = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/render" }, error: null }));
    const fetchImage = vi.fn(async () => new Response(jpeg(), { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchImage);
    const result = await prepareStorageMediaImage({ createSignedUrl: signed }, "board.jpeg", "image/jpeg", false);
    expect(signed).toHaveBeenCalledWith("board.jpeg", 60, { transform: { width: 1600, height: 1600, resize: "contain", quality: 80 } });
    expect(result).toEqual({ bytes: jpeg(), mimeType: "image/jpeg" });
    expect(decode).not.toHaveBeenCalled();
    expect(fetchImage).toHaveBeenCalledTimes(1);
  });
  it("signale la limite de résolution Storage sans télécharger l’original", async () => {
    const signed = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/render" }, error: null }));
    const fetchImage = vi.fn(async () => new Response(JSON.stringify({ message: "The source image resolution is too large to process" }), { status: 400, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchImage);
    await expect(prepareStorageMediaImage({ createSignedUrl: signed }, "board.jpeg", "image/jpeg", false, zone)).rejects.toThrow("une copie réduite privée est nécessaire");
    expect(decode).not.toHaveBeenCalled();
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(signed).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("recadre uniquement la version Storage bornée, full_resolution=%s", async full => {
    const signed = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/render" }, error: null }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(jpeg(), { headers: { "content-type": "image/jpeg" } })));
    const result = await prepareStorageMediaImage({ createSignedUrl: signed }, "board.jpeg", "image/jpeg", full, zone);
    expect(signed).toHaveBeenCalledWith("board.jpeg", 60, { transform: STORAGE_IMAGE_TRANSFORM });
    expect(decode).toHaveBeenCalledWith(jpeg());
    expect(crop).toHaveBeenCalledWith(400, 80, 800, 320);
    expect(result.bytes).toEqual(jpeg(800, 320));
  });
  it("lit les dimensions JPEG et PNG sans décodage", () => {
    expect(imageDimensions(jpeg(18000, 12000))).toEqual({ width: 18000, height: 12000 });
    const png = new Uint8Array(24);
    const view = new DataView(png.buffer);
    view.setUint32(0, 0x89504e47); view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(16, 1600); view.setUint32(20, 800);
    expect(imageDimensions(png)).toEqual({ width: 1600, height: 800 });
    expect(imageDimensions(new Uint8Array([255, 216, 255, 192, 0, 1]))).toBeUndefined();
  });
  it("refuse une fausse transformation aux dimensions originales", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(jpeg(18000, 12000), { headers: { "content-type": "image/jpeg" } })));
    await expect(prepareStorageMediaImage({ createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/render" }, error: null }) }, "board.jpeg", "image/jpeg", false, zone)).rejects.toThrow("Décodage local refusé");
    expect(decode).not.toHaveBeenCalled();
  });
  it("refuse aussi un petit fichier comprimé aux dimensions énormes", async () => {
    await expect(prepareMediaImage(jpeg(18000, 12000), "image/jpeg", false)).rejects.toThrow("Décodage local refusé");
    expect(decode).not.toHaveBeenCalled();
  });
  it("ne contourne pas un refus de signature", async () => {
    const fetchImage = vi.fn(); vi.stubGlobal("fetch", fetchImage);
    await expect(prepareStorageMediaImage({ createSignedUrl: async () => ({ data: null, error: { message: "Access denied" } }) }, "board.jpeg", "image/jpeg", false)).rejects.toThrow("Access denied");
    expect(fetchImage).not.toHaveBeenCalled();
  });
  it.each([true, false])("borne la réponse à 5 Mio même sans Content-Length : %s", async knownLength => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "content-type": "image/jpeg", ...(knownLength ? { "content-length": String(5 * 1024 * 1024 + 1) } : {}) } })));
    await expect(prepareStorageMediaImage({ createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/render" }, error: null }) }, "board.jpeg", "image/jpeg", true)).rejects.toThrow("maximum 5 Mo");
    expect(decode).not.toHaveBeenCalled();
  });
});