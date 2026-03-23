import { useEffect } from "react";
import { toast } from "sonner";
import { isChunkLoadLikeError, recoverFromStaleBuildOnce } from "@/lib/runtimeRecovery";

const CHUNK_RELOAD_FLAG = "__st_chunk_reload_attempted";

/**
 * Prevents a blank screen when a lazy-loaded route chunk fails to load.
 * Common cause: the app updated and the old tab tries to load a now-missing chunk.
 */
export function GlobalChunkErrorHandler() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadLikeError(event.reason)) return;

      // Prevent the default browser handler (which can leave the app blank)
      event.preventDefault();

      // Recover once by clearing caches/service workers then forcing a cache-busted reload.
      void recoverFromStaleBuildOnce(CHUNK_RELOAD_FLAG).then((didRecover) => {
        if (!didRecover) {
          toast.error(
            "Une mise à jour est disponible. Veuillez recharger la page.",
            {
              action: {
                label: "Recharger",
                onClick: () => window.location.reload(),
              },
            }
          );
        }
      });
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return null;
}
