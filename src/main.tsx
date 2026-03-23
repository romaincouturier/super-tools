import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import {
  installGlobalChunkRecovery,
  recoverFromStaleBuildOnce,
} from "@/lib/runtimeRecovery";

// Force-unregister any existing Service Worker to fix white-screen issues
// caused by stale cached assets from the old PWA setup.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

installGlobalChunkRecovery();

const rootElement = document.getElementById("root")!;

try {
  createRoot(rootElement).render(<App />);
} catch (error) {
  void recoverFromStaleBuildOnce("bootstrap", error).then((recovered) => {
    if (!recovered) {
      console.error("[main] Fatal bootstrap error:", error);
    }
  });
}
