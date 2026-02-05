import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline support
registerSW({
  onNeedRefresh() {
    // A new version is available — the user will be notified via the browser
    console.log("[SW] Nouvelle version disponible");
  },
  onOfflineReady() {
    console.log("[SW] Application prête pour le mode hors ligne");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
