export const IMAGE_INPUT_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_OUTPUT_MAX_BYTES = 5 * 1024 * 1024;

export interface ImageCrop { x: number; y: number; width: number; height: number }

export const IMAGE_CROP_SCHEMA = {
  type: "object",
  description: "Region of the ORIGINAL image in percentages (0–100), measured from the top-left. Crop before downscaling; use full_resolution for small text. Omit to keep the whole image.",
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