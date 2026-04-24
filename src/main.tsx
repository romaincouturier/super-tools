import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Best-effort cleanup of legacy persistence layers (old Service Worker, old
// React-Query IndexedDB cache). We never reload — that causes loops in the
// Lovable preview iframe — we just clean up and mount immediately.
function purgeLegacyCachesInBackground() {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => { /* noop */ });
    }
  } catch { /* noop */ }

  try {
    if ("caches" in window) {
      caches.keys()
        .then((keys) => keys.forEach((k) => caches.delete(k)))
        .catch(() => { /* noop */ });
    }
  } catch { /* noop */ }

  try {
    if ("indexedDB" in window) {
      indexedDB.deleteDatabase("keyval-store");
    }
  } catch { /* noop */ }
}

purgeLegacyCachesInBackground();
createRoot(document.getElementById("root")!).render(<App />);
