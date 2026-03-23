import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import {
  installGlobalChunkRecovery,
  recoverFromStaleBuildOnce,
} from "@/lib/runtimeRecovery";

const isPreviewHost =
  typeof window !== "undefined" && window.location.hostname.includes("lovableproject.com");

if (import.meta.env.PROD && !isPreviewHost) {
  registerSW({
    onNeedRefresh() {
      console.log("[SW] Nouvelle version disponible, mise à jour…");
    },
    onOfflineReady() {
      console.log("[SW] Application prête pour le mode hors ligne");
    },
  });
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
