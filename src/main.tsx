import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const legacyCacheMatchers = [
  /workbox/i,
  /^js-cache$/i,
  /^pages-cache$/i,
  /^images-cache$/i,
  /precache/i,
];

async function clearLegacyPwaState() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.warn("[bootstrap] service worker cleanup skipped:", error);
    }
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await caches.keys();
      const keysToDelete = cacheKeys.filter((key) => legacyCacheMatchers.some((matcher) => matcher.test(key)));
      await Promise.all(keysToDelete.map((key) => caches.delete(key)));
    } catch (error) {
      console.warn("[bootstrap] cache cleanup skipped:", error);
    }
  }
}

void clearLegacyPwaState();

createRoot(document.getElementById("root")!).render(<App />);
