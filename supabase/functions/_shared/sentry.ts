/**
 * Capture des erreurs des Edge Functions dans Sentry (backend / Deno).
 *
 * Source unique de vérité : `app_settings.sentry_dsn` (Paramètres › Général).
 * - Au cold start, on lit le DSN via le service role, puis on le cache en
 *   mémoire du module (TTL 15 min) → coût négligeable.
 * - Fallback sur `Deno.env.get("SENTRY_DSN")` pour rétrocompat uniquement.
 * - No-op si aucun DSN n'est trouvé.
 * - `flush` inclus : l'isolate serverless peut être figé dès la réponse.
 *
 * Règle [037] : si le catch rend une réponse d'erreur JSON, passer par
 * `createErrorResponse(msg, status, { cause, fn })` qui reporte déjà — ne pas
 * combiner les deux (double événement). reportEdgeError direct est réservé
 * aux chemins sans Response standard (crons, webhooks à format imposé,
 * erreurs partielles d'un batch) :
 *   await reportEdgeError(err, { fn: "add-training-participant" });
 */

// deno-lint-ignore no-explicit-any
let sentryMod: any = null;
let initialized = false;

// Cache module-scope du DSN (partagé entre invocations d'une même instance).
const DSN_TTL_MS = 15 * 60 * 1000;
let cachedDsn: string | null = null;
let cachedAt = 0;
let inflight: Promise<string | null> | null = null;

async function fetchDsnFromDb(): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?select=setting_value&setting_key=eq.sentry_dsn`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const val = Array.isArray(rows) && rows[0]?.setting_value;
    return typeof val === "string" && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

async function resolveDsn(): Promise<string | null> {
  const now = Date.now();
  if (cachedDsn && now - cachedAt < DSN_TTL_MS) return cachedDsn;
  if (inflight) return inflight;
  inflight = (async () => {
    const dbDsn = await fetchDsnFromDb();
    const dsn = dbDsn ?? Deno.env.get("SENTRY_DSN") ?? null;
    if (dsn) {
      cachedDsn = dsn;
      cachedAt = Date.now();
    }
    return dsn;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function ensureSentry(dsn: string): Promise<void> {
  if (initialized) return;
  if (!sentryMod) sentryMod = await import("npm:@sentry/deno");
  sentryMod.init({
    dsn,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tracesSampleRate: 0,
  });
  initialized = true;
}

export async function reportEdgeError(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const dsn = await resolveDsn();
  if (!dsn) return;
  try {
    await ensureSentry(dsn);
    sentryMod.captureException(err, context ? { extra: context } : undefined);
    await sentryMod.flush(2000);
  } catch (e) {
    console.error("[sentry] report failed", e);
  }
}
