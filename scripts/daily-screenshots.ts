/**
 * Daily screenshot capture script.
 *
 * Launches Playwright against the production app, authenticates via
 * Supabase service-role (injects session into localStorage), captures
 * screenshots of key modules, and uploads them to a Supabase Storage
 * bucket organized by date.
 *
 * Usage:
 *   npx tsx scripts/daily-screenshots.ts
 *
 * Required env vars:
 *   APP_URL                   – e.g. https://super-tools.supertilt.fr
 *   SUPABASE_URL              – e.g. https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service role key (NOT the anon key)
 *   SCREENSHOT_USER_EMAIL     – email of the account to impersonate
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const APP_URL = process.env.APP_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SCREENSHOT_USER_EMAIL = process.env.SCREENSHOT_USER_EMAIL!;
const BUCKET = "app-screenshots";

/** Pages to capture: [slug, path, waitForSelector?] */
const PAGES: [string, string, string?][] = [
  ["dashboard", "/dashboard", '[data-testid="dashboard"],.grid'],
  ["formations", "/formations", "table,ul,.grid"],
  ["formation-detail", "/formations", null!], // special: pick first link
  ["crm", "/crm", '[data-testid="crm"],.kanban,.grid'],
  ["missions", "/missions", "table,.grid"],
  ["statistiques", "/statistiques", "canvas,.recharts-wrapper,.grid"],
  ["medias", "/medias", ".grid"],
  ["lms", "/lms", ".grid,table"],
  ["catalogue", "/catalogue", ".grid,table"],
  ["events", "/events", "table,.grid"],
];

const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ── Helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getAuthSession() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate a magic link and extract the token to create a session
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: SCREENSHOT_USER_EMAIL,
  });

  if (error || !data) {
    throw new Error(`Failed to generate auth link: ${error?.message}`);
  }

  // Use the token_hash to verify and get a session
  const { data: session, error: verifyError } =
    await supabase.auth.verifyOtp({
      token_hash: data.properties.hashed_token,
      type: "magiclink",
    });

  if (verifyError || !session.session) {
    throw new Error(`Failed to verify OTP: ${verifyError?.message}`);
  }

  return session.session;
}

function buildLocalStorageItems(session: {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string };
  expires_at?: number;
  expires_in?: number;
}) {
  // Supabase JS stores auth in a key like sb-<project-ref>-auth-token
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
  const key = `sb-${projectRef}-auth-token`;

  const value = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    expires_in: session.expires_in ?? 3600,
    token_type: "bearer",
    user: session.user,
  });

  return { key, value };
}

async function uploadScreenshot(
  supabase: ReturnType<typeof createClient>,
  filePath: string,
  storagePath: string,
) {
  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error(`  Upload failed for ${storagePath}: ${error.message}`);
  } else {
    console.log(`  Uploaded: ${storagePath}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  for (const v of [
    "APP_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SCREENSHOT_USER_EMAIL",
  ]) {
    if (!process.env[v]) {
      console.error(`Missing env var: ${v}`);
      process.exit(1);
    }
  }

  const dateStr = today();
  const tmpDir = path.join("/tmp", "screenshots", dateStr);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`\n📸 Daily screenshots — ${dateStr}`);
  console.log(`   App: ${APP_URL}`);
  console.log(`   User: ${SCREENSHOT_USER_EMAIL}\n`);

  // 1. Get auth session
  console.log("Authenticating via service role...");
  const session = await getAuthSession();
  const { key: lsKey, value: lsValue } = buildLocalStorageItems(session);
  console.log("Session obtained.\n");

  // 2. Supabase admin client for uploads
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Launch browser
  const browser = await chromium.launch({ headless: true });

  for (const viewport of [
    { name: "desktop", ...VIEWPORT },
    { name: "mobile", ...MOBILE_VIEWPORT },
  ]) {
    console.log(`\n── ${viewport.name.toUpperCase()} (${viewport.width}x${viewport.height}) ──`);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.name === "mobile" ? 2 : 1,
    });

    // Inject auth into localStorage before any navigation
    await context.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: lsKey, value: lsValue },
    );

    const page = await context.newPage();

    for (const [slug, pagePath, waitSelector] of PAGES) {
      try {
        console.log(`  Capturing ${slug}...`);

        // Special case: formation-detail — navigate to list first, pick first link
        if (slug === "formation-detail") {
          await page.goto(`${APP_URL}/formations`, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
          const firstLink = await page.$('a[href*="/formations/"]');
          if (firstLink) {
            await firstLink.click();
            await page.waitForLoadState("networkidle", { timeout: 15000 });
          } else {
            console.log("    Skipped (no formation found)");
            continue;
          }
        } else {
          await page.goto(`${APP_URL}${pagePath}`, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
        }

        // Wait for content to appear
        if (waitSelector) {
          await page
            .waitForSelector(waitSelector, { timeout: 10000 })
            .catch(() => {});
        }

        // Extra settle time for charts/animations
        await page.waitForTimeout(1500);

        const fileName = `${slug}.png`;
        const filePath = path.join(tmpDir, `${viewport.name}-${fileName}`);

        await page.screenshot({
          path: filePath,
          fullPage: true,
        });

        // Upload to Supabase Storage
        const storagePath = `${dateStr}/${viewport.name}/${fileName}`;
        await uploadScreenshot(supabase, filePath, storagePath);
      } catch (err) {
        console.error(`  Failed ${slug}: ${(err as Error).message}`);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`\nDone! ${PAGES.length * 2} screenshots captured.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
