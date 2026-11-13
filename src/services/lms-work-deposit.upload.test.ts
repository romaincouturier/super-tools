import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { uploadDepositFile, DEPOSIT_NETWORK_ERROR_MESSAGE } from "./lms-work-deposit";

const netErr = Object.assign(new Error("Failed to send a request to the Edge Function"), { name: "FunctionsFetchError" });
const file = new File(["x"], "Dessin.png", { type: "image/png" });
const noWait = () => Promise.resolve();

describe("uploadDepositFile et réseau instable", () => {
  beforeEach(() => invoke.mockReset());

  it("réessaie après un échec réseau puis réussit", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: netErr })
      .mockResolvedValueOnce({ data: { publicUrl: "https://x/f.png" }, error: null });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).resolves.toMatchObject({ url: "https://x/f.png" });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("après trois échecs réseau, message clair", async () => {
    invoke.mockResolvedValue({ data: null, error: netErr });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).rejects.toThrow(DEPOSIT_NETWORK_ERROR_MESSAGE);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("ne réessaie pas une erreur renvoyée par la fonction", async () => {
    const httpErr = Object.assign(new Error("refus"), { name: "FunctionsHttpError" });
    invoke.mockResolvedValue({ data: null, error: httpErr });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).rejects.toMatchObject({ message: "refus", cause: httpErr });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each([413, 415, 401, 403, 408, 429, 504])("conserve le statut HTTP %s sans l'attribuer au réseau", async (status) => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError", context: new Response(JSON.stringify({ error: "refus serveur" }), { status }),
    });
    invoke.mockResolvedValue({ data: null, error });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).rejects.toMatchObject({
      cause: error, upload: { status, attempts: 1, size: 1, mime: "image/png" },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("extrait le refus réel du stockage dans une réponse HTTP 500", async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("non-2xx"), {
      name: "FunctionsHttpError", context: new Response(JSON.stringify({ error: "mime type image/heic is not supported" }), { status: 500 }),
    }) });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).rejects.toThrow("HTTP 500) : mime type image/heic is not supported");
  });

  it("réessaie le même fichier après 1 puis 3 secondes", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    invoke.mockResolvedValue({ data: null, error: netErr });
    await expect(uploadDepositFile(file, "l1", "a@b.fr", wait)).rejects.toMatchObject({ upload: { attempts: 3 } });
    expect(wait.mock.calls).toEqual([[1000], [3000]]);
    for (const [, options] of invoke.mock.calls) {
      const sent = options.body.get("file") as File;
      expect({ name: sent.name, size: sent.size, type: sent.type }).toEqual({ name: "Dessin.png", size: 1, type: "image/png" });
      expect(await sent.text()).toBe("x");
    }
  });
});
