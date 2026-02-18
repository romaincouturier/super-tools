import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    // A new version is available — auto-reload to apply it
    console.log("[SW] Nouvelle version disponible, mise à jour…");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[SW] Application prête pour le mode hors ligne");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
