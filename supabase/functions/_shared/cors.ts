/**
 * CORS configuration for Supabase Edge Functions
 *
 * Note: In production, consider restricting Access-Control-Allow-Origin
 * to specific domains instead of "*" for better security.
 */

const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extend corsHeaders with additional headers (for webhook endpoints, etc.)
 */
export function extendCorsHeaders(extra: Record<string, string>): Record<string, string> {
  return { ...corsHeaders, ...extra };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightIfNeeded(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/**
 * Create a JSON error response with CORS headers.
 *
 * Règle [037] : les statuts 5xx et les erreurs de quota IA (402, 429) sont
 * reportés à Sentry sans bloquer la réponse (no-op si SENTRY_DSN absent).
 */
export function createErrorResponse(
  message: string,
  status = 500
): Response {
  if (status >= 500 || status === 402 || status === 429) {
    const report = import("./sentry.ts")
      .then(({ reportEdgeError }) => reportEdgeError(new Error(message), { status }))
      .catch(() => {});
    const edgeRuntime = (globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
    }).EdgeRuntime;
    edgeRuntime?.waitUntil?.(report);
  }
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Create a JSON success response with CORS headers
 */
export function createJsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
