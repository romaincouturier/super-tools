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
    await expect(uploadDepositFile(file, "l1", "a@b.fr", noWait)).rejects.toBe(httpErr);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
