const CACHE_BUSTER_PARAM = "__st_build";

export function isChunkLoadLikeError(reason: unknown) {
  const message = String((reason instanceof Error ? reason.message : reason) ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("dynamically imported module")
  );
}

export async function clearServiceWorkersAndCaches() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
  }
}

export async function recoverFromStaleBuildOnce(flagKey: string) {
  if (typeof window === "undefined") return false;

  try {
    if (sessionStorage.getItem(flagKey)) {
      return false;
    }

    sessionStorage.setItem(flagKey, "1");
    await clearServiceWorkersAndCaches();

    const url = new URL(window.location.href);
    url.searchParams.set(CACHE_BUSTER_PARAM, Date.now().toString());
    window.location.replace(url.toString());
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}
