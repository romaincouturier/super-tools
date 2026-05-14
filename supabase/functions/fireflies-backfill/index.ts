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

  let limit = 20;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 100) {
      limit = body.limit;
    }
  } catch (_) { /* no body */ }

  // List recent transcripts from Fireflies
  const listRes = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({
      query: `query($limit: Int) { transcripts(limit: $limit) { id title date duration } }`,
      variables: { limit },
    }),
  });
  if (!listRes.ok) {
    const txt = await listRes.text();
    return new Response(JSON.stringify({ error: "GraphQL list failed", status: listRes.status, body: txt }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const listJson = await listRes.json();
  const transcripts: Array<{ id: string; title: string; date: number }> = listJson?.data?.transcripts ?? [];

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
});
