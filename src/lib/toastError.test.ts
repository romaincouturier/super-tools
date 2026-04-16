import { describe, it, expect, vi } from "vitest";
import { toastError } from "./toastError";

describe("toastError", () => {
  it("forwards a string as the description", () => {
    const toast = vi.fn();
    toastError(toast, "Impossible de supprimer.");
    expect(toast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de supprimer.",
      variant: "destructive",
    });
  });

  it("extracts `message` when given an Error instance", () => {
    const toast = vi.fn();
    toastError(toast, new Error("connexion perdue"));
    expect(toast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "connexion perdue",
      variant: "destructive",
    });
  });

  it("falls back to a generic message for unknown shapes", () => {
    const toast = vi.fn();
    toastError(toast, { weird: true } as unknown);
    expect(toast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Une erreur est survenue.",
      variant: "destructive",
    });
  });

  it("honours a custom title when provided", () => {
    const toast = vi.fn();
    toastError(toast, "Session expirée", { title: "Erreur de connexion" });
    expect(toast).toHaveBeenCalledWith({
      title: "Erreur de connexion",
      description: "Session expirée",
      variant: "destructive",
    });
  });

  it("always forces variant: destructive (not spoofable via options)", () => {
    const toast = vi.fn();
    toastError(toast, "boom");
    expect((toast.mock.calls[0][0] as { variant: string }).variant).toBe("destructive");
  });
});
