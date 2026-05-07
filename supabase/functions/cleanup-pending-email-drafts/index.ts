import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read configurable retention (default 7 days)
    const { data: setting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "email_draft_pending_retention_days")
      .maybeSingle();

    const retentionDays = parseInt(String(setting?.setting_value ?? "7"), 10) || 7;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[cleanup-pending-email-drafts] Retention: ${retentionDays}d, cutoff: ${cutoff}`);

    const { data: deleted, error } = await supabase
      .from("mission_email_drafts")
      .delete()
      .in("status", ["pending", "rejected"])
      .lt("created_at", cutoff)
      .select("id");

    if (error) throw error;

    const count = deleted?.length ?? 0;
    console.log(`[cleanup-pending-email-drafts] Deleted ${count} drafts`);

    return new Response(
      JSON.stringify({ success: true, deleted: count, retentionDays, cutoff }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cleanup-pending-email-drafts] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
