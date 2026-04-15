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
 */
export function toastError(
  toast: ToastFn,
  description: string | Error | unknown,
  options?: { title?: string },
) {
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
