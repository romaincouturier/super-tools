import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {},
});

createRoot(document.getElementById("root")!).render(<App />);
