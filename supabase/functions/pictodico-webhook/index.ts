import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting: max 10 requests per IP per 10 minutes
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// Global flood protection: max 60 requests per minute across all IPs
const GLOBAL_RATE_LIMIT_MAX = 60;
const GLOBAL_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function extractWordFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const word = parsed.searchParams.get("_sf_s");
    return word ? decodeURIComponent(word).trim() : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Secret verification ---
  const reqUrl = new URL(req.url);
  const providedKey = reqUrl.searchParams.get("key");

  if (!providedKey) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: settingRow } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "pictodico_webhook_secret")
    .single();

  const configuredSecret = settingRow?.setting_value || "";
  if (!configuredSecret || providedKey !== configuredSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Rate limiting ---
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();
  const windowStartIp = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
  const windowStartGlobal = new Date(now - GLOBAL_RATE_LIMIT_WINDOW_MS).toISOString();

  // Global flood check
  const { count: globalCount } = await supabase
    .from("pictodico_rate_limit")
    .select("*", { count: "exact", head: true })
    .gte("requested_at", windowStartGlobal);

  if ((globalCount ?? 0) >= GLOBAL_RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  // Per-IP check
  const { count: ipCount } = await supabase
    .from("pictodico_rate_limit")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("requested_at", windowStartIp);

  if ((ipCount ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000),
      },
    });
  }

  // Record this request
  await supabase.from("pictodico_rate_limit").insert({ ip_address: ip });

  // Async cleanup of old rate limit records (fire-and-forget)
  const cleanupBefore = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  supabase.from("pictodico_rate_limit").delete().lt("requested_at", cleanupBefore).then(() => {});

  // --- Parse body ---
  let body: { type?: string; url?: string; erreur?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { type, url: pageUrl, erreur } = body;

  if (!type || !pageUrl) {
    return new Response(JSON.stringify({ error: "Missing required fields: type, url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (type !== "demande_ajout" && type !== "erreur_signalee") {
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const word = extractWordFromUrl(pageUrl);

  const { error: insertError } = await supabase.from("pictodico_words").insert({
    word: word || pageUrl,
    language: "fr",
    source: "webhook",
    request_type: type,
    source_url: pageUrl,
    error_description: erreur || null,
  });

  if (insertError) {
    console.error("Error inserting word:", insertError);
    return new Response(JSON.stringify({ error: "Failed to store request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
