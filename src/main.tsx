import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("[SW] Nouvelle version disponible, mise à jour…");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[SW] Application prête pour le mode hors ligne");
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);

