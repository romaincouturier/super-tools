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

function isFromBrowserExtension(event: Sentry.ErrorEvent): boolean {
  const frames =
    event.exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ?? [];
  return frames.some(
    (frame) => typeof frame.filename === "string" && /extension:\/\//i.test(frame.filename),
  );
}

/**
 * Initialize Sentry error tracking.
 *
 * Phase 1 — front-end only. Supabase errors (edge functions, RPC, RLS) are out
 * of scope for now.
 *
 * Only runs on production builds. Preview/dev builds (`vite` dev server or
 * `vite build --mode development`) have `import.meta.env.PROD === false` and
 * never initialize Sentry. The DSN is read from a Lovable environment variable;
 * a Sentry DSN is public by design (exposed client-side) and safe to ship.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (!import.meta.env.PROD || !dsn) return;

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
