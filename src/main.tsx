import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Aggressive cleanup of any legacy PWA / SW / cache artefacts.
// Returning users were getting stale UIs because old service workers and
// IndexedDB-persisted query caches restored outdated data on boot.
async function purgeLegacyCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
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
      indexedDB.deleteDatabase("keyval-store"); // idb-keyval default DB
    }
  } catch { /* noop */ }
}

void purgeLegacyCaches();

createRoot(document.getElementById("root")!).render(<App />);
