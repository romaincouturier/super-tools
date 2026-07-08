import { defineConfig, devices } from "@playwright/test";

// Smoke tests du golden path (règle 032 d'IMPROVEMENTS.md).
// Prérequis : `npm run build` (le serveur `vite preview` est lancé automatiquement).
// Lancement : `npm run test:e2e`
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Permet d'utiliser un Chromium système (ex: conteneurs avec browser préinstallé)
        // sans télécharger : PW_CHROMIUM_PATH=/chemin/vers/chromium npm run test:e2e
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
