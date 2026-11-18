import { useState } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GalleryBlockEditor from "./GalleryBlockEditor";
import type { GalleryBlockContent } from "@/types/lms-blocks";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), toast: vi.fn(), report: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/useLms", () => ({ uploadLmsImage: mocks.upload }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/sentry", () => ({ reportHandledError: mocks.report }));
vi.mock("@/lib/toastError", () => ({ toastError: mocks.error }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function setup(initial: GalleryBlockContent = { images: [{ url: "existing" }], mode: "grid", columns: 3 }) {
  let current = initial;
  function Harness() {
    const [content, setContent] = useState(initial);
    return <GalleryBlockEditor lessonId="lesson" content={content} onChange={(next) => { current = next; setContent(next); }} />;
  }
  const view = render(<Harness />);
  const input = view.container.querySelector('input[multiple]');
  if (!input) throw new Error("Sélecteur absent");
  return { ...view, input, content: () => current };
}

const image = (name: string) => new File(["image"], name, { type: "image/png" });

describe("import multiple galerie", () => {
  it("importe 74 images avec trois envois maximum et les conserve toutes en ordre alphabétique", async () => {
    let active = 0;
    let peak = 0;
    mocks.upload.mockImplementation(async (file: File, lessonId: string) => {
      expect(lessonId).toBe("lesson");
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, file.name === "01.png" ? 10 : 0));
      active--;
      return file.name;
    });
    const files = Array.from({ length: 74 }, (_, i) => image(`${String(i + 1).padStart(2, "0")}.png`)).reverse();
    const view = setup();
    fireEvent.change(view.input, { target: { files } });
    await waitFor(() => expect(view.content().images).toHaveLength(75));
    expect(peak).toBe(3);
    expect(view.content()).toEqual({ images: [{ url: "existing" }, ...files.reverse().map((file) => ({ url: file.name }))], mode: "grid", columns: 3 });
    expect(mocks.toast).toHaveBeenCalledWith({ title: "74 images importées" });
  });

  it("ajoute progressivement dans l’ordre malgré les fins concurrentes et ne relance pas un second lot", async () => {
    const pending = new Map<string, (url: string) => void>();
    mocks.upload.mockImplementation((file: File) => new Promise<string>((resolve) => pending.set(file.name, resolve)));
    const view = setup();
    fireEvent.change(view.input, { target: { files: [image("c.png"), image("a.png"), image("b.png"), image("d.png")] } });
    fireEvent.change(view.input, { target: { files: [image("duplicate.png")] } });
    await act(async () => { pending.get("b.png")?.("b.png"); });
    expect(view.content().images).toEqual([{ url: "existing" }]);
    await act(async () => { pending.get("a.png")?.("a.png"); });
    expect(view.content().images).toEqual([{ url: "existing" }, { url: "a.png" }, { url: "b.png" }]);
    await act(async () => { pending.get("d.png")?.("d.png"); pending.get("c.png")?.("c.png"); });
    expect(view.content().images.map((img) => img.url)).toEqual(["existing", "a.png", "b.png", "c.png", "d.png"]);
    expect(mocks.upload.mock.calls.map(([file]) => file.name)).toEqual(["a.png", "b.png", "c.png", "d.png"]);
  });

  it("poursuit le lot après un échec et conserve les succès", async () => {
    const failure = new Error("Envoi refusé");
    mocks.upload.mockImplementation(async (file: File) => {
      if (file.name === "b.png") throw failure;
      return file.name;
    });
    const view = setup();
    fireEvent.change(view.input, { target: { files: [image("c.png"), image("b.png"), image("a.png")] } });
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(view.content().images.map((img) => img.url)).toEqual(["existing", "a.png", "c.png"]);
    expect(mocks.report).toHaveBeenCalledWith(failure);
    expect(mocks.error).toHaveBeenCalledWith(mocks.toast, "1 image en échec.", { title: "2 images importées" });
    mocks.upload.mockResolvedValue("retry.png");
    fireEvent.change(view.input, { target: { files: [image("retry.png")] } });
    await waitFor(() => expect(view.content().images).toHaveLength(4));
  });

  it.each([false, true])("prend toutes les images déposées sur la galerie ou une case vide (%s)", async (emptySlot) => {
    mocks.upload.mockImplementation(async (file: File) => file.name);
    const view = setup({ images: emptySlot ? [{ url: null }] : [], mode: "carousel" });
    const singleInput = view.container.querySelector('input[type="file"]:not([multiple])');
    const target = emptySlot ? singleInput?.parentElement : view.container.firstElementChild;
    if (!target) throw new Error("Zone absente");
    fireEvent.drop(target, { dataTransfer: { files: [image("z.png"), new File(["text"], "note.txt", { type: "text/plain" }), image("a.png")], types: ["Files"] } });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(view.content().images).toEqual([...(emptySlot ? [{ url: null }] : []), { url: "a.png" }, { url: "z.png" }]);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(view.content().mode).toBe("carousel");
  });
});