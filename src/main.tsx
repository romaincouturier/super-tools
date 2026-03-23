import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Unregister stale Service Workers and clear ALL caches left by the old PWA setup.
// Without this, returning users get white screens from cached outdated assets.
// Important: we clear ALL caches, not just named ones — Vite/browser caches
// don't follow workbox naming conventions.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  }).catch(() => {});
}
if ("caches" in window) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
