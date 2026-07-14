/**
 * fireflies-backfill
 *
 * Lists recent Fireflies transcripts via GraphQL and imports any that are
 * missing in our `transcripts` table by calling the fireflies-webhook for each.
 *
 * Usage: POST /fireflies-backfill { "limit": 20 }   (auth required)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY") ?? "";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (!FIREFLIES_API_KEY) {
    return new Response(JSON.stringify({ error: "FIREFLIES_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let limit = 30;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 50) {
      limit = body.limit;
    }
  } catch (_) { /* no body */ }

  try {
    // List recent transcripts from Fireflies (capped to preserve daily quota ~50/day)
    const debugRes = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({
        query: `query($limit: Int) {
          user { user_id name email num_transcripts }
          transcripts(limit: $limit) { id title date }
        }`,
        variables: { limit },
      }),
    });

    if (debugRes.status === 429) {
      const retryAfter = debugRes.headers.get("retry-after") ?? "unknown";
      console.warn("[fireflies-backfill] rate-limited, retry-after:", retryAfter);
      return new Response(JSON.stringify({
        ok: false,
        rate_limited: true,
        retry_after: retryAfter,
        hint: "Fireflies daily quota exhausted. Will retry at next cron tick.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const debugJson = await debugRes.json();
    console.log("[fireflies-backfill] debug:", JSON.stringify(debugJson));

    const transcripts: Array<{ id: string; title: string; date: number }> = debugJson?.data?.transcripts ?? [];
    if (!transcripts.length) {
      return new Response(JSON.stringify({
        ok: true,
        total_listed: 0,
        debug: debugJson,
        hint: "Fireflies returned 0 transcripts.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find which are missing in DB
    const ids = transcripts.map((t) => t.id);
    const { data: existing } = await (admin as any)
      .from("transcripts")
      .select("external_id")
      .eq("source", "fireflies")
      .in("external_id", ids);
    const existingSet = new Set((existing as Array<{ external_id: string }> ?? []).map((r) => r.external_id));
    const missing = transcripts.filter((t) => !existingSet.has(t.id));

    // Read webhook secret
    const { data: settingRow } = await (admin as any)
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "fireflies_webhook_secret")
      .maybeSingle();
    const webhookSecret = (settingRow as any)?.setting_value ?? "";

    const results: Array<{ id: string; title: string; status: number; body: string }> = [];
    for (const t of missing) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/fireflies-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
        },
        body: JSON.stringify({ meetingId: t.id, eventType: "backfill" }),
      });
      results.push({ id: t.id, title: t.title, status: r.status, body: await r.text() });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_listed: transcripts.length,
        already_imported: transcripts.length - missing.length,
        newly_imported: results.filter((r) => r.status === 200 && r.body.includes("imported")).length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[fireflies-backfill] error:", error);
    await reportEdgeError(error, { fn: "fireflies-backfill" });
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
