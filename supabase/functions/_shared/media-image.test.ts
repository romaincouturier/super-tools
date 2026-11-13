import { describe, expect, it, vi } from "vitest";
import { cropPixels, validateImageCrop, prepareMediaImage, IMAGE_INPUT_MAX_BYTES } from "./media-image.ts";

const crop = vi.fn();
const resize = vi.fn();
const encodeJPEG = vi.fn(async () => new Uint8Array([1, 2, 3]));
const image = { width: 4000, height: 2000, crop, resize, encodeJPEG };
vi.mock("https://deno.land/x/imagescript@1.3.0/mod.ts", () => ({ Image: { decode: async () => image } }));

describe("zones de planches", () => {
  it("convertit les pourcentages depuis les dimensions originales", () => {
    expect(cropPixels({ x: 25, y: 10, width: 50, height: 40 }, 4000, 2000)).toEqual({ x: 1000, y: 200, width: 2000, height: 800 });
  });
  it.each([null, {}, { x: -1, y: 0, width: 20, height: 20 }, { x: 80, y: 0, width: 30, height: 20 }, { x: 0, y: 0, width: 0, height: 20 }, { x: 0, y: 0, width: Infinity, height: 20 }])("refuse une zone invalide %j", value => {
    expect(() => validateImageCrop(value)).toThrow();
  });
  it("ne recadre pas si crop est omis", () => expect(validateImageCrop(undefined)).toBeUndefined());
  it("accepte la totalité de la planche", () => expect(validateImageCrop({ x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 0, width: 100, height: 100 }));
  it("réduit sans perdre les proportions à 1600 pixels", async () => {
    resize.mockClear();
    const result = await prepareMediaImage(new Uint8Array([7]), "image/jpeg", false);
    expect(resize).toHaveBeenCalledWith(1600, 800);
    expect(result).toEqual({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });
  });
  it("recadre depuis l’original sans réduire en pleine résolution", async () => {
    crop.mockClear(); resize.mockClear();
    const result = await prepareMediaImage(new Uint8Array([7]), "image/jpeg", true, { x: 25, y: 10, width: 50, height: 40 });
    expect(crop).toHaveBeenCalledWith(1000, 200, 2000, 800);
    expect(resize).not.toHaveBeenCalled();
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("préserve exactement un petit original en pleine résolution", async () => {
    const bytes = new Uint8Array([9, 8]);
    expect(await prepareMediaImage(bytes, "image/png", true)).toEqual({ bytes, mimeType: "image/png" });
  });
  it("accepte une source de 15 Mo et refuse au-delà", async () => {
    expect((await prepareMediaImage(new Uint8Array(15 * 1024 * 1024), "image/jpeg", true)).bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(IMAGE_INPUT_MAX_BYTES).toBe(15 * 1024 * 1024);
    await expect(prepareMediaImage(new Uint8Array(15 * 1024 * 1024 + 1), "image/jpeg", false)).rejects.toThrow("15 Mo");
  });
});