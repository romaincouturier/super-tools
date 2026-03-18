import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerToast, offlineGuard } from "./offlineMutationGuard";

describe("offlineMutationGuard", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    registerToast(null as never);
  });

  describe("registerToast", () => {
    it("stores the toast function for later use", () => {
      const toast = vi.fn();
      registerToast(toast);

      vi.stubGlobal("navigator", { onLine: false });
      const guarded = offlineGuard(vi.fn().mockResolvedValue("ok"));
      guarded().catch(() => {});

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Action impossible", variant: "destructive" })
      );
    });
  });

  describe("offlineGuard", () => {
    it("calls the original function when online", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const guarded = offlineGuard(fn);

      const result = await guarded("arg1", "arg2");

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("result");
    });

    it("rejects with an error when offline", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const fn = vi.fn().mockResolvedValue("result");
      const guarded = offlineGuard(fn);

      await expect(guarded()).rejects.toThrow("Offline: action impossible");
      expect(fn).not.toHaveBeenCalled();
    });

    it("shows a toast when offline and toast is registered", async () => {
      const toast = vi.fn();
      registerToast(toast);
      vi.stubGlobal("navigator", { onLine: false });

      const guarded = offlineGuard(vi.fn().mockResolvedValue("ok"));
      await guarded().catch(() => {});

      expect(toast).toHaveBeenCalledWith({
        title: "Action impossible",
        description: "Vous êtes hors ligne. Reconnectez-vous pour effectuer cette action.",
        variant: "destructive",
      });
    });

    it("does not throw when offline and no toast is registered", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const guarded = offlineGuard(vi.fn().mockResolvedValue("ok"));

      await expect(guarded()).rejects.toThrow("Offline: action impossible");
    });
  });
});
