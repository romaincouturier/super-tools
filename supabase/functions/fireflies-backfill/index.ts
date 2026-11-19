import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isCronOrServiceRole, hasManagedCronCredential, isStaffCaller } from "../_shared/cron-auth.ts";
import { listFirefliesPage } from "../_shared/fireflies-client.ts";
import { refreshRecentFireflies } from "./refresh.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (!(await isCronOrServiceRole(req)) && !(await hasManagedCronCredential(req)) && !(await isStaffCaller(req, "transcripts"))) return createErrorResponse("Unauthorized", 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    const { data: setting, error: settingError } = await admin.from("app_settings").select("setting_value").eq("setting_key", "fireflies_webhook_secret").single();
    if (settingError || !setting?.setting_value) throw new Error("Secret de réception Fireflies non configuré");
    const result = await refreshRecentFireflies(listFirefliesPage, async (ids) => {
      const { data: rows, error } = await admin.from("transcripts").select("external_id,status,raw_text").eq("source", "fireflies").in("external_id", ids);
      if (error) throw error;
      return rows ?? [];
    }, async (id) => {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fireflies-webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Webhook-Secret": String(setting.setting_value) }, body: JSON.stringify({ meetingId: id, eventType: "backfill" }) });
      if (!response.ok) throw new Error(`Import Fireflies ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (!result.imported && result.skipped !== "already imported") throw new Error("Import Fireflies non confirmé");
      return Boolean(result.imported);
    });
    const lastError = result.invalid_existing ? `${result.invalid_existing} fiche(s) vide(s) ou en erreur : ouvrir le contrôle d’exhaustivité pour réparation manuelle.` : null;
    const saved = await admin.from("polling_cursors").update({ cursor: "{}", last_synced_at: new Date().toISOString(), status: lastError ? "error" : "idle", last_error: lastError }).eq("source", "fireflies");
    if (saved.error) throw saved.error;
    return new Response(JSON.stringify({ ok: true, ...result, inventory_complete: false, cursor: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("polling_cursors").update({ status: "error", last_error: String(e) }).eq("source", "fireflies");
    return createErrorResponse(String(e), 502, { cause: e, fn: "fireflies-backfill" });
  }
});