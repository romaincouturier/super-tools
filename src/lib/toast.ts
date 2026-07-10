import { toast as sonnerToast } from "sonner";
import { reportHandledError } from "@/lib/sentry";

/**
 * Point de passage unique des toasts sonner (règle [037]).
 *
 * Importer depuis "@/lib/toast", jamais depuis "sonner" directement :
 * `toast.error` reporte aussi l'erreur à Sentry. Passer l'erreur d'origine
 * via `cause` quand le message affiché est générique :
 *
 *   toast.error("Impossible d'envoyer.", { cause: err });
 *
 * Sans `cause`, le message devient un breadcrumb Sentry (pas un événement).
 * Même API que sonner pour tout le reste (success, info, promise, ...).
 */
type SonnerToast = typeof sonnerToast;
type ErrorOptions = Parameters<SonnerToast["error"]>[1] & { cause?: unknown };

const error = (message: Parameters<SonnerToast["error"]>[0], options?: ErrorOptions) => {
  const { cause, ...sonnerOptions } = options ?? {};
  reportHandledError(cause ?? (typeof message === "string" ? message : null));
  return sonnerToast.error(message, sonnerOptions);
};

export const toast = new Proxy(sonnerToast, {
  get(target, prop, receiver) {
    if (prop === "error") return error;
    return Reflect.get(target, prop, receiver);
  },
}) as SonnerToast;
