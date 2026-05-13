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
      .in("setting_key", ["google_drive_folder_testimonials"]);

    const folderIdRow = settings?.find((s) => s.setting_key === "google_drive_folder_testimonials");
    if (!folderIdRow?.setting_value) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "google_drive_folder_testimonials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO Sprint 3: poll Drive folder, transcribe new videos, extract client name/company, store in testimonials table
    console.log("poll-drive-testimonials: ready — implementation pending Sprint 3");

    await admin
      .from("polling_cursors")
      .update({ last_synced_at: new Date().toISOString(), status: "idle" })
      .eq("source", "drive_testimonials");

    return new Response(
      JSON.stringify({ ok: true, message: "poll-drive-testimonials stub — Sprint 3 pending" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("poll-drive-testimonials error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
