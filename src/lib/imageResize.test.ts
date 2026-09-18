import { describe, it, expect, afterEach, vi } from "vitest";
import { resizeImageFile } from "./imageResize";

const makeFile = (name = "photo.png", type = "image/png") =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resizeImageFile", () => {
  it("rend le fichier tel quel quand createImageBitmap n'existe pas", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const file = makeFile();

    await expect(resizeImageFile(file)).resolves.toBe(file);
  });

  it("rend le fichier tel quel quand le décodage de l'image échoue", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("decode")),
    );
    const file = makeFile();

    await expect(resizeImageFile(file)).resolves.toBe(file);
  });

  it("ne touche pas à un SVG, qui perdrait sa nature vectorielle", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const file = makeFile("logo.svg", "image/svg+xml");

    await expect(resizeImageFile(file)).resolves.toBe(file);
    expect(decode).not.toHaveBeenCalled();
  });

  it("ne touche pas à un fichier qui n'est pas une image", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const file = makeFile("contrat.pdf", "application/pdf");

    await expect(resizeImageFile(file)).resolves.toBe(file);
    expect(decode).not.toHaveBeenCalled();
  });
});
