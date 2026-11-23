export const IMAGE_INPUT_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_OUTPUT_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_LOCAL_MAX_BYTES = 512 * 1024;
export const IMAGE_LOCAL_MAX_PIXELS = 1600 * 1600;
export const STORAGE_IMAGE_TRANSFORM = { width: 1600, height: 1600, resize: "contain" as const, quality: 80 };

export interface ImageCrop { x: number; y: number; width: number; height: number }

export const IMAGE_CROP_SCHEMA = {
  type: "object",
  description: "Region in percentages (0–100), measured from the top-left. Private Storage images are reduced to 1600 px before local cropping to bound memory. Omit to keep the whole image.",
  properties: {
    x: { type: "number", minimum: 0, maximum: 100 },
    y: { type: "number", minimum: 0, maximum: 100 },
    width: { type: "number", exclusiveMinimum: 0, maximum: 100 },
    height: { type: "number", exclusiveMinimum: 0, maximum: 100 },
  },
  required: ["x", "y", "width", "height"],
  additionalProperties: false,
};

export function validateImageCrop(value: unknown): ImageCrop | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("crop doit contenir x, y, width, height en pourcentages");
  const c = value as Record<string, unknown>;
  const keys = ["x", "y", "width", "height"];
  if (Object.keys(c).some(k => !keys.includes(k)) || keys.some(k => typeof c[k] !== "number" || !Number.isFinite(c[k]))) throw new Error("crop : quatre nombres finis sont requis");
  const { x, y, width, height } = c as unknown as ImageCrop;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100) throw new Error("crop : la zone doit rester entièrement dans l’image (0–100 %)");
  return { x, y, width, height };
}

export function cropPixels(crop: ImageCrop, width: number, height: number) {
  const x = Math.min(width - 1, Math.floor(width * crop.x / 100));
  const y = Math.min(height - 1, Math.floor(height * crop.y / 100));
  return {
    x, y,
    width: Math.min(width - x, Math.max(1, Math.ceil(width * (crop.x + crop.width) / 100) - x)),
    height: Math.min(height - y, Math.max(1, Math.ceil(height * (crop.y + crop.height) / 100) - y)),
  };
}

export async function prepareMediaImage(bytes: Uint8Array, mimeType: string, fullResolution: boolean, crop?: ImageCrop) {
  if (bytes.length > IMAGE_INPUT_MAX_BYTES) throw new Error("Image source trop lourde (maximum 15 Mo)");
  if (fullResolution && !crop && bytes.length <= IMAGE_OUTPUT_MAX_BYTES) return { bytes, mimeType };
  assertLocalImageSafe(bytes);
  const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  const image = await Image.decode(bytes);
  if (crop) {
    const region = cropPixels(crop, image.width, image.height);
    image.crop(region.x, region.y, region.width, region.height);
  }
  if (!fullResolution && Math.max(image.width, image.height) > 1600) {
    const ratio = 1600 / Math.max(image.width, image.height);
    image.resize(Math.max(1, Math.round(image.width * ratio)), Math.max(1, Math.round(image.height * ratio)));
  }
  const output = await image.encodeJPEG(fullResolution ? 95 : 85);
  if (output.length > IMAGE_OUTPUT_MAX_BYTES) throw new Error("Image retournée trop lourde (maximum 5 Mo) : utiliser crop pour lire une zone en pleine résolution");
  return { bytes: output, mimeType: "image/jpeg" };
}

/** Dimensions JPEG/PNG sans décompression des pixels. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return undefined;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return undefined;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return undefined;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += length;
  }
  return undefined;
}

function assertLocalImageSafe(bytes: Uint8Array, transformed = false) {
  const dimensions = imageDimensions(bytes);
  if ((!transformed && bytes.length > IMAGE_LOCAL_MAX_BYTES) || !dimensions ||
    dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > IMAGE_LOCAL_MAX_PIXELS) {
    throw new Error("Décodage local refusé : une transformation Storage à 1600 pixels est requise");
  }
}

export async function prepareStorageMediaImage(
  bucket: { createSignedUrl: (path: string, seconds: number, options?: { transform: typeof STORAGE_IMAGE_TRANSFORM }) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> },
  path: string,
  mimeType: string,
  fullResolution: boolean,
  crop?: ImageCrop,
) {
  const { data, error } = await bucket.createSignedUrl(path, 60, fullResolution && !crop ? undefined : { transform: STORAGE_IMAGE_TRANSFORM });
  if (error || !data) throw new Error(`Transformation Storage impossible : ${error?.message ?? "URL absente"}`);
  const response = await fetch(data.signedUrl, { headers: { Accept: "image/jpeg" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    if (response.status === 400) {
      const detail = await response.json().catch(() => null);
      if (detail?.message === "The source image resolution is too large to process") {
        throw new Error("La résolution de l’original dépasse la limite de transformation du stockage ; une copie réduite privée est nécessaire. Aucun décodage de l’original effectué.");
      }
    }
    throw new Error(`Transformation Storage impossible (${response.status})`);
  }
  if (Number(response.headers.get("content-length")) > IMAGE_OUTPUT_MAX_BYTES) throw new Error("Image retournée trop lourde (maximum 5 Mo) : désactiver full_resolution");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image Storage vide");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > IMAGE_OUTPUT_MAX_BYTES) {
      await reader.cancel();
      throw new Error("Image retournée trop lourde (maximum 5 Mo) : désactiver full_resolution");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const returnedMime = response.headers.get("content-type")?.split(";")[0] || mimeType;
  if (!returnedMime.startsWith("image/")) throw new Error("Storage n’a pas retourné une image");
  if (!crop) return { bytes, mimeType: returnedMime };
  assertLocalImageSafe(bytes, true);
  const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  const image = await Image.decode(bytes);
  const region = cropPixels(crop, image.width, image.height);
  image.crop(region.x, region.y, region.width, region.height);
  const output = await image.encodeJPEG(80);
  if (output.length > IMAGE_OUTPUT_MAX_BYTES) throw new Error("Image recadrée trop lourde (maximum 5 Mo)");
  return { bytes: output, mimeType: "image/jpeg" };
}