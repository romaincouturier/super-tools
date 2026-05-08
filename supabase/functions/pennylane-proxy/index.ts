// Pennylane API v2 proxy
// Reads the Bearer token from app_settings and forwards GET/POST/PUT requests to
// https://app.pennylane.com/api/external/v2/<path>
// Authenticated: requires a valid Supabase JWT (no service role exposed to client).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";

// Whitelist endpoint paths to avoid open proxy abuse.
// Pattern matched via prefix on the requested `path`.
const ALLOWED_PREFIXES = [
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

    // ── Fetch Pennylane token from app_settings ─────────────────────────────
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: setting } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "pennylane_api_token")
      .maybeSingle();

    const token = setting?.setting_value?.trim();
    if (!token) {
      return createErrorResponse(
        "Token API Pennylane non configuré dans les paramètres généraux.",
        400,
      );
    }

    // ── Build target URL ────────────────────────────────────────────────────
    const cleanPath = path.replace(/^\/+/, "");
    const url = new URL(`${PENNYLANE_BASE}/${cleanPath}`);
    if (query && typeof query === "object") {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    // ── Forward to Pennylane ────────────────────────────────────────────────
    const init: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        // Opt in to the new 2026 API behavior (descending order, etc.)
        "X-Use-2026-API-Changes": "true",
      },
    };
    if (method !== "GET" && payload !== undefined) {
      init.body = JSON.stringify(payload);
    }

    const apiUrl = url.toString();
    console.log(`[pennylane-proxy] ${method} ${apiUrl.replace(token, "***")}`);

    const response = await fetch(apiUrl, init);
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error("[pennylane-proxy] API error", response.status, text.slice(0, 500));
      return createJsonResponse(
        { error: "Pennylane API error", status: response.status, details: data },
        response.status,
      );
    }

    return createJsonResponse(data, 200);
  } catch (err) {
    console.error("[pennylane-proxy] Unexpected error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
