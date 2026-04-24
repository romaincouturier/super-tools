import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ─────────────────────────────────────────────────────────────────────────────
// Aggressive cache purge.
//
// Returning visitors were stuck on a months-old UI because:
//   • a legacy Service Worker was still controlling the page and serving
//     stale HTML/JS chunks from the Cache Storage API
//   • an old React-Query persister had cached UI state in IndexedDB
//
// Strategy: on every boot, BEFORE we mount React, we wipe every persistence
// layer the app has ever used. If we actually had to remove a SW (meaning the
// current page is still being served by it), we force one hard reload so the
// next request fetches the real, fresh bundle from the network.
// ─────────────────────────────────────────────────────────────────────────────

const RELOAD_MARKER = "__supertools_sw_purged__";

async function purgeLegacyCaches(): Promise<{ hadServiceWorker: boolean }> {
  let hadServiceWorker = false;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      hadServiceWorker = regs.length > 0;
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* noop */ }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* noop */ }

  // Wipe the legacy React-Query IndexedDB cache that used to persist UI state.
  try {
    if ("indexedDB" in window) {
      indexedDB.deleteDatabase("keyval-store");
    }
  } catch { /* noop */ }

  return { hadServiceWorker };
}

async function bootstrap() {
  const { hadServiceWorker } = await purgeLegacyCaches();

  // If a Service Worker was controlling this page, the current HTML/JS may
  // still be the stale cached version. Trigger ONE hard reload so we get the
  // real bundle from the network. The marker prevents an infinite loop.
  if (hadServiceWorker && !sessionStorage.getItem(RELOAD_MARKER)) {
    sessionStorage.setItem(RELOAD_MARKER, "1");
    window.location.reload();
    return;
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
