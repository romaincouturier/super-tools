// Pennylane API v2 proxy
// Forwards GET/POST/PUT requests to the Pennylane external API v2.
// Token, base URL and headers live in _shared/pennylane.ts (rule [052]).
// Authenticated: requires a valid Supabase JWT (no service role exposed to client).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { getPennylaneToken, pennylaneFetch } from "../_shared/pennylane.ts";

// Whitelist endpoint paths to avoid open proxy abuse.
// Pattern matched via prefix on the requested `path`.
const ALLOWED_PREFIXES = [
  "me",
  "customer_invoices",
  "supplier_invoices",
  "customers",
  "suppliers",
  "products",
  "bank_accounts",
  "transactions",
  "categories",
];

function isAllowedPath(path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  return ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + "/") || normalized.startsWith(prefix + "?"),
  );
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    // ── Auth: require a Supabase JWT ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Missing Authorization header", 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    // ── Parse request body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const path: string = (body.path || "").toString();
    const method: string = (body.method || "GET").toString().toUpperCase();
    const query: Record<string, string | number | boolean> | undefined = body.query;
    const payload: unknown = body.body;

    if (!path || !isAllowedPath(path)) {
      return createErrorResponse(
        `Invalid path. Allowed prefixes: ${ALLOWED_PREFIXES.join(", ")}`,
        400,
      );
    }
    if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
      return createErrorResponse("Invalid method", 400);
    }

    // ── Token et appel : protocole Pennylane centralisé dans _shared ─────────
    const admin = createClient(supabaseUrl, serviceKey);
    let token: string;
    try {
      token = await getPennylaneToken(admin);
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : "Token Pennylane indisponible", 400);
    }

    console.log(`[pennylane-proxy] ${method} ${path}`);
    const res = await pennylaneFetch(
      token,
      method as "GET" | "POST" | "PUT" | "DELETE",
      path,
      { query, body: payload },
    );

    if (!res.ok) {
      console.error("[pennylane-proxy] API error", res.status, res.raw.slice(0, 500));
      return createJsonResponse(
        { error: "Pennylane API error", status: res.status, details: res.data },
        res.status,
      );
    }

    return createJsonResponse(res.data, 200);
  } catch (err) {
    console.error("[pennylane-proxy] Unexpected error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
