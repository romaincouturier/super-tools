import { useEffect } from "react";
import { toast } from "sonner";

function isChunkLoadError(reason: unknown) {
  const message = String((reason instanceof Error ? reason.message : reason) ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk")
  );
}

/**
 * Catches unhandled chunk-load failures (e.g. after a deploy while a tab is
 * still open) and shows a reload toast instead of a blank screen.
 */
export function GlobalChunkErrorHandler() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;

      event.preventDefault();

      toast.error(
        "Une mise à jour est disponible. Veuillez recharger la page.",
        {
          duration: Infinity,
          action: {
            label: "Recharger",
            onClick: () => window.location.reload(),
          },
        }
      );
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return null;
}
