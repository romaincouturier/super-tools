/**
 * CORS configuration for Supabase Edge Functions
 *
 * Set the ALLOWED_ORIGINS environment variable (comma-separated) to restrict
 * which domains can call these functions from a browser.
 * Example: ALLOWED_ORIGINS=https://app.supertilt.fr,http://localhost:5173
 *
 * When ALLOWED_ORIGINS is not set, falls back to "*" for local development.
 */

const ALLOWED_HEADERS =
  "authorization, x-client-info, x-api-key, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

const allowedOrigins: string[] =
  Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

function resolveOrigin(requestOrigin?: string | null): string {
  if (allowedOrigins.length === 0) return "*";
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return allowedOrigins[0];
}

/**
 * Build CORS headers for a given request.
 * When ALLOWED_ORIGINS is set, returns the matching origin + Vary header.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get("origin") ?? null;
  const resolved = resolveOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolved,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  if (resolved !== "*") {
    headers["Vary"] = "Origin";
  }
  return headers;
}

/**
 * Static CORS headers for backwards compatibility.
 * Prefer getCorsHeaders(req) for per-request origin matching.
 */
export const corsHeaders = getCorsHeaders();

/**
 * Handle CORS preflight request (uses per-request origin matching)
 */
export function handleCorsPreflightIfNeeded(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}

/**
 * Create a JSON error response with CORS headers
 */
export function createErrorResponse(
  message: string,
  status = 500,
  req?: Request
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    }
  );
}

/**
 * Create a JSON success response with CORS headers
 */
export function createJsonResponse(
  data: unknown,
  status = 200,
  req?: Request
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    }
  );
}
