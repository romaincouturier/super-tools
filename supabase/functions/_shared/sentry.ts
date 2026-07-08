/**
 * Capture des erreurs des Edge Functions dans Sentry (backend / Deno).
 *
 * - No-op si le secret `SENTRY_DSN` n'est pas défini (rien n'est envoyé).
 * - Import dynamique du SDK : une éventuelle erreur de chargement reste isolée
 *   au chemin d'erreur et ne casse jamais la fonction.
 * - `flush` est inclus : en environnement serverless, l'isolate peut être figé
 *   dès la réponse renvoyée — il faut vider la file AVANT de rendre la réponse.
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
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  try {
    await ensureSentry(dsn);
    sentryMod.captureException(err, context ? { extra: context } : undefined);
    await sentryMod.flush(2000);
  } catch (e) {
    console.error("[sentry] report failed", e);
  }
}
