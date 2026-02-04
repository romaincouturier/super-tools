import { useEffect } from "react";
import { toast } from "sonner";

const CHUNK_RELOAD_FLAG = "__st_chunk_reload_attempted";

function isChunkLoadError(reason: unknown) {
  const message = String((reason as any)?.message ?? reason ?? "");
  return message.includes("Failed to fetch dynamically imported module");
}

/**
 * Prevents a blank screen when a lazy-loaded route chunk fails to load.
 * Common cause: the app updated and the old tab tries to load a now-missing chunk.
 */
export function GlobalChunkErrorHandler() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;

      // Prevent the default browser handler (which can leave the app blank)
      event.preventDefault();

      // Reload once to pick up the latest asset manifest.
      if (!sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
        window.location.reload();
        return;
      }

      toast.error(
        "Une mise à jour est disponible. Veuillez recharger la page.",
        {
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
