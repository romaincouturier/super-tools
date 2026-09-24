import { defineConfig, devices } from "@playwright/test";

// Scan d'anonymisation du mode démo (règle [070] d'IMPROVEMENTS.md).
// Construit l'app contre un faux Supabase, visite chaque route interne et
// ouvre boutons, onglets, menus et modales. Lancement : `npm run scan:demo`.
// Sous-ensemble : DEMO_SCAN_ROUTES=/crm,/formations npm run scan:demo
export default defineConfig({
  testDir: "./e2e/demo-scan",
  timeout: 420_000,
  fullyParallel: true,
  workers: Number(process.env.DEMO_SCAN_WORKERS ?? 4),
  reporter: "list",
  globalTeardown: "./e2e/demo-scan/report.ts",
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  // Build non minifié : le rapport nomme les composants React qui affichent la fuite.
  webServer: {
    command:
      "VITE_SUPABASE_URL=https://demoscan.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=demo-scan npx vite build --minify false --outDir dist-demo-scan && npx vite preview --outDir dist-demo-scan --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
