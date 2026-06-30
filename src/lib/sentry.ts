import * as Sentry from "@sentry/react";

// Errors we never want to send — browser quirks and noise that are not
// actionable application bugs.
const IGNORED_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
];

// Scripts whose errors are never our code (browser extensions injecting JS).
const DENY_URLS = [
  /extensions?\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
];

const BOT_USER_AGENT = /bot|crawler|spider|crawling|headless|lighthouse|pingdom|gtmetrix|slurp/i;

// Cache the DSN so a returning session initializes Sentry synchronously at
// startup, before the authenticated app_settings fetch resolves.
const DSN_CACHE_KEY = "supertools.sentry_dsn";

let initialized = false;

function isFromBrowserExtension(event: Sentry.ErrorEvent): boolean {
  const frames =
    event.exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ?? [];
  return frames.some(
    (frame) => typeof frame.filename === "string" && /extension:\/\//i.test(frame.filename),
  );
}

function start(dsn: string): void {
  if (initialized) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || "production",
    // Performance monitoring disabled to stay on the free plan.
    tracesSampleRate: 0,
    ignoreErrors: IGNORED_ERRORS,
    denyUrls: DENY_URLS,
    beforeSend(event) {
      if (BOT_USER_AGENT.test(navigator.userAgent)) return null;
      if (isFromBrowserExtension(event)) return null;
      return event;
    },
  });
}

/**
 * Synchronous startup path, called from main.tsx.
 *
 * Phase 1 — front-end only. Supabase errors (edge functions, RPC, RLS) are out
 * of scope. Only runs on production builds (`import.meta.env.PROD`); preview/dev
 * builds never initialize Sentry.
 *
 * Uses, in order of priority: the optional `VITE_SENTRY_DSN` env override, then
 * the DSN cached from a previous authenticated session. The fresh value comes
 * from the `sentry_dsn` app setting (Paramètres › Général) via configureSentry().
 * A Sentry DSN is public by design (exposed client-side), so caching it is safe.
 */
export function initSentryFromCache(): void {
  if (!import.meta.env.PROD) return;
  const envDsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || "";
  let cached = "";
  try {
    cached = localStorage.getItem(DSN_CACHE_KEY) || "";
  } catch {
    // localStorage unavailable (private mode) — fall back to env/runtime only.
  }
  const dsn = (envDsn || cached).trim();
  if (dsn) start(dsn);
}

/**
 * Runtime path, called once the `sentry_dsn` app setting is loaded. Caches the
 * value for the next startup and initializes Sentry if it isn't already.
 *
 * Init is one-shot: changing the DSN takes effect on the next page load (the
 * cache is refreshed immediately). An empty value is a no-op.
 */
export function configureSentry(dsn: string | null | undefined): void {
  if (!import.meta.env.PROD) return;
  const value = (dsn ?? "").trim();
  if (!value) return;
  try {
    localStorage.setItem(DSN_CACHE_KEY, value);
  } catch {
    // ignore — caching is best-effort
  }
  start(value);
}

/** Whether Sentry.init has run (prod + a DSN was available). */
export function isSentryActive(): boolean {
  return initialized;
}

/**
 * Sends a deliberate test event so the Sentry dashboard receives a first error.
 * Returns the event id, or null if Sentry is not active (dev/preview or no DSN).
 */
export function sendSentryTestEvent(): string | null {
  if (!initialized) return null;
  return Sentry.captureException(
    new Error("Super Tools — événement de test Sentry (déclenché manuellement)"),
  );
}
