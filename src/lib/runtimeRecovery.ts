const RECOVERY_FLAG_KEY = "stale-build-recovery-attempted";
const BUILD_BUST_QUERY_KEY = "__st_build";

export function isChunkLoadError(error: unknown): boolean {
  const message = String((error instanceof Error ? error.message : error) ?? "");

  return (
    message.includes("ChunkLoadError") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("dynamically imported module")
  );
}

async function clearServiceWorkersAndCaches() {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn("[runtimeRecovery] Failed to unregister service workers:", error);
  }

  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[runtimeRecovery] Failed to clear caches:", error);
  }
}

function hardReloadWithCacheBuster() {
  const url = new URL(window.location.href);
  url.searchParams.set(BUILD_BUST_QUERY_KEY, Date.now().toString());
  window.location.replace(url.toString());
}

export async function recoverFromStaleBuildOnce(source: string, error?: unknown): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!isChunkLoadError(error)) return false;

  const alreadyAttempted = sessionStorage.getItem(RECOVERY_FLAG_KEY) === "1";
  if (alreadyAttempted) return false;

  console.warn(`[runtimeRecovery] Triggered by ${source}`, error);
  sessionStorage.setItem(RECOVERY_FLAG_KEY, "1");

  await clearServiceWorkersAndCaches();
  hardReloadWithCacheBuster();

  return true;
}

export function installGlobalChunkRecovery() {
  if (typeof window === "undefined") return;

  const onWindowError = (event: ErrorEvent) => {
    void recoverFromStaleBuildOnce("window.error", event.error ?? event.message);
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    void recoverFromStaleBuildOnce("window.unhandledrejection", event.reason);
  };

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
}
