import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isStaffCaller } from "../_shared/cron-auth.ts";
import { getValidDriveAccessToken, listDriveFolder, assertDriveFolderAccessible } from "../_shared/google-drive-helper.ts";
import { GOOGLE_MEET_ROOT } from "../_shared/drive-transcription.ts";
import { listFirefliesPage, getFirefliesMeeting } from "../_shared/fireflies-client.ts";
import { classifyInventoryItem, inventorySummary, firefliesText, transcriptHash, canRepairInventoryItem, type InventoryItem } from "../_shared/transcript-inventory.ts";
import { importFirefliesText } from "../_shared/transcript-repair.ts";

const schema = z.object({
  action: z.enum(["start", "continue", "repair", "refresh"]).default("start"),
  source: z.enum(["fireflies", "google_drive"]).default("google_drive"),
  run_id: z.string().uuid().optional(),
  external_id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
});

async function readRows(admin: any, source: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("transcripts").select("id,external_id,status,raw_text,metadata,duration_seconds,updated_at,title").eq("source", source).order("id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

async function reconcile(admin: any, run: any): Promise<void> {
  const rows = await readRows(admin, run.source);
  const byId = new Map(rows.map((r) => [r.external_id, r]));
  run.items = await Promise.all((run.items as InventoryItem[]).map((item) => classifyInventoryItem(run.source, item, byId.get(item.external_id))));
  run.summary = inventorySummary(run.items);
  run.summary.local_not_in_source = rows.filter((r) => !run.items.some((i: InventoryItem) => i.external_id === r.external_id)).length;
}

async function saveRun(admin: any, run: any): Promise<void> {
  const { error } = await admin.from("transcript_inventory_runs").update({ cursor: run.cursor, items: run.items, summary: run.summary, status: run.status, errors: run.errors, completed_at: run.status === "complete" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", run.id);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);
  if (!(await isStaffCaller(req, "transcripts"))) return createErrorResponse("Unauthorized", 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: userData } = await admin.auth.getUser((req.headers.get("Authorization") ?? "").replace(/^Bearer /, ""));
  const userId = userData.user?.id;
  if (!userId) return createErrorResponse("Unauthorized", 403);
  let run: any;
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return createErrorResponse("Demande de contrôle invalide", 400);
    const body = parsed.data;
    if (body.action === "start") {
      const cursor: any = { phase: "list", skip: 0, cutoff: new Date().toISOString(), detail_index: 0 };
      if (body.source === "google_drive") {
        const { data, error } = await admin.from("app_settings").select("setting_value").eq("setting_key", "google_drive_folder_transcripts").maybeSingle();
        if (error) throw error;
        cursor.queue = [...new Set(`${data?.setting_value ?? ""},${GOOGLE_MEET_ROOT}`.split(",").map((s) => s.trim()).filter(Boolean))];
        cursor.index = 0;
        cursor.visited = [];
      }
      const { data, error } = await admin.from("transcript_inventory_runs").insert({ source: body.source, created_by: userId, cursor }).select("*").single();
      if (error) throw error;
      run = data;
    } else {
      if (!body.run_id) return createErrorResponse("Contrôle manquant", 400);
      const { data, error } = await admin.from("transcript_inventory_runs").select("*").eq("id", body.run_id).single();
      if (error || !data) return createErrorResponse("Contrôle introuvable", 404);
      run = data;
    }

    if (body.action === "repair") {
      const item = run.items.find((i: InventoryItem) => i.external_id === body.external_id);
      if (!item) return createErrorResponse("Élément absent du rapport", 400);
      const { data: existing, error } = await admin.from("transcripts").select("*").eq("source", run.source).eq("external_id", item.external_id).maybeSingle();
      if (error) throw error;
      const current = await classifyInventoryItem(run.source, item, existing ?? undefined);
      if (!canRepairInventoryItem(current, existing ?? undefined)) return createErrorResponse("Cet élément ne peut pas être réparé : corbeille, traitement actif ou absence d’écart récupérable", 409);
      const { data: log, error: logError } = await admin.from("transcript_repair_logs").insert({ run_id: run.id, external_id: item.external_id, created_by: userId, transcript_id: existing?.id, before_data: existing, status: "submitted" }).select("id").single();
      if (logError) throw logError;
      try {
        let after: any;
        if (run.source === "fireflies") {
          after = (await importFirefliesText(admin, item.external_id, existing)).row;
          const index = run.items.findIndex((i: InventoryItem) => i.external_id === item.external_id);
          run.items[index] = { ...item, checked: true, source_hash: after.metadata.source_hash, source_sentences: after.metadata.source_sentence_count };
        } else {
          const patch = { status: "processing", error_message: null, assemblyai_id: null, metadata: { ...(existing?.metadata ?? {}), silent_repair: true, repair_log_id: log.id, audio_parts: [], audio_total_parts: 0 } };
          const query = existing
            ? admin.from("transcripts").update(patch).eq("id", existing.id).eq("updated_at", existing.updated_at).neq("status", "trashed").neq("status", "processing")
            : admin.from("transcripts").insert({ ...patch, source: "google_drive", external_id: item.external_id, title: item.title });
          const saved = await query.select("*").single();
          if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Fiche modifiée simultanément");
          after = saved.data;
          const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/submit-drive-transcript`, { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ transcript_id: after.id, drive_file_id: item.external_id }) });
          if (!response.ok) {
            const failure = `Soumission Drive ${response.status}: ${await response.text()}`;
            await admin.from("transcripts").update({ status: "error", error_message: failure }).eq("id", after.id);
            throw new Error(failure);
          }
        }
        const savedLog = await admin.from("transcript_repair_logs").update({ transcript_id: after.id, after_data: after, status: run.source === "fireflies" ? "success" : "submitted" }).eq("id", log.id);
        if (savedLog.error) throw savedLog.error;
      } catch (e) {
        await admin.from("transcript_repair_logs").update({ status: "error", error_message: String(e) }).eq("id", log.id);
        throw e;
      }
    } else if (body.action !== "refresh" && run.cursor.phase !== "done") {
      run.status = "running";
      run.errors = [];
      const cursor = run.cursor;
      const items = new Map<string, InventoryItem>(run.items.map((i: InventoryItem) => [i.external_id, i]));
      if (run.source === "fireflies") {
        if (cursor.phase === "list") {
          for (let n = 0; n < 4; n++) {
            const page = await listFirefliesPage(cursor.skip, cursor.cutoff);
            const newIds = page.filter((t) => !items.has(t.id));
            if (page.length && !newIds.length) throw new Error("Pagination Fireflies sans progression ; contrôle incomplet");
            for (const t of page) items.set(t.id, { external_id: t.id, title: t.title, date: new Date(t.date).toISOString() });
            cursor.skip += page.length;
            run.items = [...items.values()];
            if (page.length < 50) { cursor.phase = "details"; break; }
          }
        }
        if (cursor.phase === "details") {
          for (let n = 0; n < 12 && cursor.detail_index < run.items.length; n++) {
            const item = run.items[cursor.detail_index];
            const meeting = await getFirefliesMeeting(item.external_id);
            item.source_hash = await transcriptHash(firefliesText(meeting));
            item.source_sentences = meeting.sentences?.length ?? 0;
            item.source_duration = Number(meeting.duration ?? 0) * 60;
            item.checked = true;
            cursor.detail_index++;
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }
          if (cursor.detail_index >= run.items.length) cursor.phase = "done";
        }
      } else {
        const token = await getValidDriveAccessToken(admin);
        if (!token) throw new Error("Google Drive non connecté");
        for (let n = 0; n < 20 && cursor.index < cursor.queue.length; n++) {
          const folder = cursor.queue[cursor.index];
          if (!cursor.page_token) await assertDriveFolderAccessible(folder, token);
          const page = await listDriveFolder(folder, token, { pageToken: cursor.page_token });
          for (const file of page.files) {
            if (file.mimeType === "application/vnd.google-apps.folder" && !cursor.queue.includes(file.id)) cursor.queue.push(file.id);
            if (file.mimeType.startsWith("video/")) items.set(file.id, { external_id: file.id, title: file.name, date: file.createdTime, source_duration: Number(file.videoMediaMetadata?.durationMillis ?? 0) / 1000, checked: true });
          }
          run.items = [...items.values()];
          cursor.page_token = page.nextPageToken;
          if (!cursor.page_token) cursor.index++;
        }
        if (cursor.index >= cursor.queue.length) cursor.phase = "done";
      }
      run.status = cursor.phase === "done" ? "complete" : "running";
    }
    await reconcile(admin, run);
    await saveRun(admin, run);
    return new Response(JSON.stringify({ run }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (run) {
      if (run.cursor.phase !== "done") run.status = "incomplete";
      run.errors = [...(run.errors ?? []), e instanceof Error ? e.message : String(e)];
      await reconcile(admin, run).catch(() => {});
      await saveRun(admin, run).catch(() => {});
    }
    return createErrorResponse(e instanceof Error ? e.message : String(e), 502, { cause: e, fn: "drive-list-check" });
  }
});