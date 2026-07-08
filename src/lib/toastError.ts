import { reportHandledError } from "@/lib/sentry";
import type { useToast } from "@/hooks/use-toast";

type ToastFn = ReturnType<typeof useToast>["toast"];

/**
 * Shorthand for destructive error toasts.
 *
 * Before:
 *   toast({ title: "Erreur", description: "Impossible de …", variant: "destructive" });
 * After:
 *   toastError(toast, "Impossible de …");
 *
 * Accepts an `Error`, a `string`, or `unknown` (falls back to a generic
 * message). Centralises the error title and the destructive variant so we
 * keep a single voice across 140+ error paths.
 *
 * Toute erreur affichée passe par reportHandledError (règle [037]) : passer
 * l'erreur d'origine via `options.cause` quand le message affiché est un
 * texte générique, sinon l'Error passée en description est capturée. Un
 * message string seul devient un breadcrumb, pas un événement.
 */
export function toastError(
  toast: ToastFn,
  description: string | Error | unknown,
  options?: { title?: string; cause?: unknown },
) {
  reportHandledError(options?.cause ?? description);
  const desc =
    description instanceof Error
      ? description.message
      : typeof description === "string"
        ? description
        : "Une erreur est survenue.";
  toast({
    title: options?.title ?? "Erreur",
    description: desc,
    variant: "destructive",
  });
}
