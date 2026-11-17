import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSignedFile, uploadWithProgress } from "./uploadProgress";

class FakeXHR {
  static current: FakeXHR;
  upload = { onprogress: null as ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  responseText = '{"media":{"id":"saved"}}';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() { FakeXHR.current = this; }
}

afterEach(() => vi.unstubAllGlobals());

describe("progression réelle de l'envoi", () => {
  it("remonte 25 % puis 75 % selon les octets transférés et attend la réponse", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const progress = vi.fn();
    const settled = vi.fn();
    const promise = uploadWithProgress("/upload", "POST", new FormData(), {}, progress).then(settled);
    const xhr = FakeXHR.current;
    xhr.upload.onprogress?.({ loaded: 250, total: 1000, lengthComputable: true });
    xhr.upload.onprogress?.({ loaded: 750, total: 1000, lengthComputable: true });
    expect(progress.mock.calls.map(c => c[0])).toEqual([0, 25, 75]);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    xhr.onload?.();
    await promise;
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(settled).toHaveBeenCalledWith({ media: { id: "saved" } });
  });
  it("ne considère pas un transfert HTTP refusé comme réussi", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const promise = uploadWithProgress("/upload", "POST", new FormData(), {});
    FakeXHR.current.status = 413;
    FakeXHR.current.responseText = '{"error":"Fichier trop volumineux"}';
    FakeXHR.current.onload?.();
    await expect(promise).rejects.toThrow("Fichier trop volumineux");
  });
  it("signale une coupure réseau", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const promise = uploadWithProgress("/upload", "POST", new FormData(), {});
    FakeXHR.current.onerror?.();
    await expect(promise).rejects.toThrow("Connexion interrompue");
  });
  it("conserve la destination signée et envoie le fichier binaire en PUT", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    const promise = uploadSignedFile("media", "training/id/photo.jpg", "signed-token", file, "image/jpeg", true);
    const xhr = FakeXHR.current;
    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://test.supabase.co/storage/v1/object/upload/sign/media/training/id/photo.jpg?token=signed-token");
    expect(xhr.send).toHaveBeenCalledWith(file);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "image/jpeg");
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("x-upsert", "true");
    xhr.onload?.();
    await promise;
  });
});