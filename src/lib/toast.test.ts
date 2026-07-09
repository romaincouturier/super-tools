import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  init: vi.fn(),
  flush: vi.fn(),
}));

vi.mock("sonner", () => {
  const base = vi.fn();
  return {
    toast: Object.assign(base, {
      error: vi.fn(() => "toast-id"),
      success: vi.fn(),
      info: vi.fn(),
    }),
  };
});

import * as Sentry from "@sentry/react";
import { toast as sonnerToast } from "sonner";
import { toast } from "./toast";
import { reportHandledError } from "./sentry";
import { toastError } from "./toastError";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reportHandledError", () => {
  it("capture une Error vers Sentry", () => {
    const err = new Error("boom");
    reportHandledError(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
  });

  it("ne capture un même objet Error qu'une seule fois (dédup)", () => {
    const err = new Error("boom-dedup");
    reportHandledError(err);
    reportHandledError(err);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("transmet le contexte extra", () => {
    const err = new Error("ctx");
    reportHandledError(err, { queryKey: ["a"] });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { queryKey: ["a"] } });
  });

  it("un message string devient un breadcrumb, pas un événement", () => {
    reportHandledError("Veuillez remplir le titre");
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "handled-error",
      message: "Veuillez remplir le titre",
      level: "error",
    });
  });

  it("ignore null/undefined", () => {
    reportHandledError(null);
    reportHandledError(undefined);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });
});

describe("toast (wrapper sonner)", () => {
  it("toast.error avec cause capture la cause et ne la passe pas à sonner", () => {
    const err = new Error("edge failed");
    toast.error("Impossible d'envoyer.", { cause: err, description: "detail" });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
    expect(sonnerToast.error).toHaveBeenCalledWith("Impossible d'envoyer.", { description: "detail" });
  });

  it("toast.error sans cause laisse un breadcrumb", () => {
    toast.error("Erreur simple");
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(sonnerToast.error).toHaveBeenCalledWith("Erreur simple", {});
  });

  it("les autres méthodes passent à sonner sans capture", () => {
    toast.success("ok");
    expect(sonnerToast.success).toHaveBeenCalledWith("ok");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("toastError (shadcn)", () => {
  it("capture l'Error passée en description et affiche son message", () => {
    const show = vi.fn();
    const err = new Error("détail technique");
    toastError(show, err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
    expect(show).toHaveBeenCalledWith({
      title: "Erreur",
      description: "détail technique",
      variant: "destructive",
    });
  });

  it("capture options.cause quand le message affiché est générique", () => {
    const show = vi.fn();
    const err = new Error("cause réelle");
    toastError(show, "Impossible d'envoyer votre retour.", { cause: err });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
    expect(show).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible d'envoyer votre retour.",
      variant: "destructive",
    });
  });

  it("un string seul ne crée pas d'événement Sentry", () => {
    const show = vi.fn();
    toastError(show, "Champ requis");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
