import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings } = await admin
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["fireflies_api_key"]);

    const apiKeyRow = settings?.find((s) => s.setting_key === "fireflies_api_key");
    if (!apiKeyRow?.setting_value) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "fireflies_api_key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO Sprint 2: query Fireflies GraphQL API, import new transcripts, store in transcripts table
    console.log("poll-fireflies-transcripts: ready — implementation pending Sprint 2");

    await admin
      .from("polling_cursors")
      .update({ last_synced_at: new Date().toISOString(), status: "idle" })
      .eq("source", "fireflies");

    return new Response(
      JSON.stringify({ ok: true, message: "poll-fireflies-transcripts stub — Sprint 2 pending" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("poll-fireflies-transcripts error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
