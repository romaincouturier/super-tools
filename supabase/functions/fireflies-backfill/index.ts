import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isCronOrServiceRole, hasManagedCronCredential, isStaffCaller } from "../_shared/cron-auth.ts";
import { listFirefliesPage } from "../_shared/fireflies-client.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (!(await isCronOrServiceRole(req)) && !(await hasManagedCronCredential(req)) && !(await isStaffCaller(req, "transcripts"))) return createErrorResponse("Unauthorized", 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    const { data: checkpoint, error: checkpointError } = await admin.from("polling_cursors").select("cursor").eq("source", "fireflies").single();
    if (checkpointError) throw checkpointError;
    let cursor: any = {};
    try { cursor = JSON.parse(checkpoint.cursor ?? "{}"); } catch (e) { console.warn("Ancien curseur Fireflies", String(e)); }
    if (!cursor.cutoff) cursor = { skip: 0, cutoff: new Date().toISOString(), seen: [] };
    const meetings = await listFirefliesPage(cursor.skip, cursor.cutoff);
    const { data: rows, error } = await admin.from("transcripts").select("external_id,status,raw_text").eq("source", "fireflies").in("external_id", meetings.map((t) => t.id));
    if (error) throw error;
    const existing = new Map((rows ?? []).map((r) => [r.external_id, r]));
    const invalid = meetings.filter((t) => { const row = existing.get(t.id); return row && row.status !== "trashed" && (row.status === "error" || !row.raw_text?.trim()); });
    const { data: setting, error: settingError } = await admin.from("app_settings").select("setting_value").eq("setting_key", "fireflies_webhook_secret").single();
    if (settingError || !setting?.setting_value) throw new Error("Secret de réception Fireflies non configuré");
    let imported = 0;
    let index = 0;
    for (; index < meetings.length; index++) {
      const meeting = meetings[index];
      if (existing.has(meeting.id)) continue;
      if (imported >= 3) break;
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fireflies-webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Webhook-Secret": String(setting.setting_value) }, body: JSON.stringify({ meetingId: meeting.id, eventType: "backfill" }) });
      if (!response.ok) throw new Error(`Import Fireflies ${response.status}: ${await response.text()}`);
      const result = await response.json();
      if (!result.imported && result.skipped !== "already imported") throw new Error("Import Fireflies non confirmé");
      if (result.imported) imported++;
    }
    const finished = index === meetings.length && meetings.length < 50;
    const nextCursor = finished ? {} : { ...cursor, skip: cursor.skip + index };
    const lastError = invalid.length ? `${invalid.length} fichhe(s) vide(s) ou en erreur : ouvrir le contrôle d’exhaustivité pour réparation manuelle.` : null;
    const saved = await admin.from("polling_cursors").update({ cursor: JSON.stringify(nextCursor), last_synced_at: new Date().toISOString(), status: lastError ? "error" : "idle", last_error: lastError }).eq("source", "fireflies");
    if (saved.error) throw saved.error;
    return new Response(JSON.stringify({ ok: true, total_listed: meetings.length, newly_imported: imported, invalid_existing: invalid.length, inventory_complete: finished, cursor: nextCursor }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("polling_cursors").update({ status: "error", last_error: String(e) }).eq("source", "fireflies");
    return createErrorResponse(String(e), 502, { cause: e, fn: "fireflies-backfill" });
  }
});