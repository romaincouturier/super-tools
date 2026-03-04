import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";

const BOOTSTRAP_RELOAD_FLAG = "__st_bootstrap_reload_attempted";
const SW_CLEANUP_RELOAD_FLAG = "__st_sw_cleanup_reload_attempted";
const isPreviewHost =
  typeof window !== "undefined" && window.location.hostname.includes("lovableproject.com");

function shouldReloadForBootstrapError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? "");
  return (
    message.includes("can't detect preamble") ||
    message.includes("Importing a module script failed") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

async function cleanupServiceWorkersAndCaches() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
  }

  if (navigator.serviceWorker.controller && !sessionStorage.getItem(SW_CLEANUP_RELOAD_FLAG)) {
    sessionStorage.setItem(SW_CLEANUP_RELOAD_FLAG, "1");
    window.location.reload();
  }
}

if (import.meta.env.PROD && !isPreviewHost) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("[SW] Nouvelle version disponible, mise à jour…");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[SW] Application prête pour le mode hors ligne");
    },
  });
} else {
  void cleanupServiceWorkersAndCaches();
}

async function bootstrap() {
  // Defensive fallback for rare dev preamble race/mismatch cases.
  if (import.meta.env.DEV) {
    const win = window as Window & {
      $RefreshReg$?: () => void;
      $RefreshSig$?: () => (type: unknown) => unknown;
    };

    if (!win.$RefreshReg$) {
      win.$RefreshReg$ = () => {};
    }

    if (!win.$RefreshSig$) {
      win.$RefreshSig$ = () => (type: unknown) => type;
    }
  }

  try {
    const [{ default: App }] = await Promise.all([import("./App.tsx")]);
    const rootElement = document.getElementById("root");

    if (!rootElement) {
      throw new Error("Root element introuvable");
    }

    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("[bootstrap] Échec du chargement de l'application:", error);

    if (
      shouldReloadForBootstrapError(error) &&
      !sessionStorage.getItem(BOOTSTRAP_RELOAD_FLAG)
    ) {
      sessionStorage.setItem(BOOTSTRAP_RELOAD_FLAG, "1");
      window.location.reload();
      return;
    }

    const rootElement = document.getElementById("root");
    if (!rootElement) return;

    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:hsl(150 5% 95%);font-family:system-ui,sans-serif;">
        <div style="max-width:520px;background:white;border:1px solid hsl(210 20% 85%);border-radius:12px;padding:20px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:hsl(210 33% 9%);">Erreur de chargement</h1>
          <p style="margin:0 0 12px;color:hsl(210 20% 40%);">L'application n'a pas pu démarrer. Un rechargement corrige généralement le problème.</p>
          <button id="st-reload-btn" style="border:0;border-radius:8px;padding:10px 14px;background:hsl(49 100% 45%);color:hsl(210 33% 9%);font-weight:600;cursor:pointer;">Recharger</button>
        </div>
      </div>
    `;

    document
      .getElementById("st-reload-btn")
      ?.addEventListener("click", () => window.location.reload());
  }
}

void bootstrap();
