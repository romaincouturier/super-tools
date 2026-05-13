/**
 * poll-drive-transcripts
 *
 * Cron function — detects new video files in a Google Drive folder,
 * submits them to AssemblyAI for transcription, and on completion
 * analyzes them with Claude (summary + tags) then notifies Slack.
 *
 * Two-pass strategy per run:
 *   Pass 1 — Check pending AssemblyAI jobs and mark completed ones ready.
 *   Pass 2 — Discover new Drive files and submit them (up to 5 per run).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import {
  assertDriveFolderAccessible,
  getModifiedAfterWithLookback,
  getValidDriveAccessToken,
  listDriveFolder,
  downloadDriveFileBytes,
  uploadToAssemblyAI,
  submitAssemblyAIJob,
  pollAssemblyAIJob,
  analyzeTranscript,
  notifySlack,
} from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";
const ASSEMBLYAI_WEBHOOK_SECRET = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";
const ASSEMBLYAI_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/assemblyai-webhook`;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["google_drive_folder_transcripts", "slack_crm_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const folderId = get("google_drive_folder_transcripts");
    const slackChannel = get("slack_crm_channel") || "general";

    if (!folderId) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "google_drive_folder_transcripts not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ASSEMBLYAI_API_KEY) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "ASSEMBLYAI_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = { checked: 0, completed: 0, submitted: 0, errors: 0 };

    // ── Pass 1: check pending AssemblyAI jobs ────────────────────
    const { data: processing } = await (admin as any)
      .from("transcripts")
      .select("id, title, assemblyai_id")
      .eq("source", "google_drive")
      .eq("status", "processing")
      .not("assemblyai_id", "is", null);

    for (const row of (processing ?? []) as Array<{ id: string; title: string; assemblyai_id: string }>) {
      results.checked++;
      const result = await pollAssemblyAIJob(row.assemblyai_id, ASSEMBLYAI_API_KEY);
      if (result === null) continue; // still in progress
      if (result === "error") {
        await (admin as any).from("transcripts").update({ status: "error", error_message: "AssemblyAI transcription failed" }).eq("id", row.id);
        results.errors++;
        continue;
      }
      const analysis = await analyzeTranscript(result.text);
      await (admin as any).from("transcripts").update({
        status: "ready",
        raw_text: result.text,
        duration_seconds: result.duration,
        summary: analysis.summary,
        tags: analysis.tags,
        assemblyai_id: null,
      }).eq("id", row.id);
      results.completed++;
      await notifySlack(
        `🎤 *Nouveau transcript prêt* : ${row.title || "Sans titre"}\n${analysis.summary}`,
        slackChannel,
      );

      // Trigger RAG indexation
      await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: "transcript", source_id: row.id }),
      }).catch(() => {});
    }

    // ── Pass 2: discover new Drive files ────────────────────────
    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) {
      await (admin as any).from("polling_cursors")
        .update({ last_synced_at: new Date().toISOString(), status: "error", last_error: "No Drive access token" })
        .eq("source", "drive_transcripts");
      return new Response(
        JSON.stringify({ ...results, warning: "No Google Drive access token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await assertDriveFolderAccessible(folderId, accessToken);

    const { data: cursorRow } = await (admin as any)
      .from("polling_cursors")
      .select("cursor, last_synced_at")
      .eq("source", "drive_transcripts")
      .single();

    const modifiedAfter = getModifiedAfterWithLookback(
      (cursorRow as { cursor?: string; last_synced_at?: string } | null)?.last_synced_at,
    );

    const { files } = await listDriveFolder(folderId, accessToken, {
      modifiedAfter,
      mimeTypePrefix: "video/",
    });

    // Filter to files not already in DB
    const existingIds = files.length > 0
      ? ((await (admin as any).from("transcripts").select("external_id").in("external_id", files.map((f) => f.id))).data ?? [])
          .map((r: { external_id: string }) => r.external_id)
      : [];

    const toProcess = files.filter((f) => !existingIds.includes(f.id)).slice(0, 5);

    for (const file of toProcess) {
      try {
        // Insert as pending first
        const { data: inserted } = await (admin as any)
          .from("transcripts")
          .insert({ source: "google_drive", external_id: file.id, title: file.name, status: "processing" })
          .select("id")
          .single();

        if (!inserted) continue;

        const bytes = await downloadDriveFileBytes(file.id, accessToken);
        const uploadUrl = await uploadToAssemblyAI(bytes, ASSEMBLYAI_API_KEY);
        const jobId = await submitAssemblyAIJob(uploadUrl, ASSEMBLYAI_API_KEY);

        await (admin as any).from("transcripts").update({ assemblyai_id: jobId }).eq("id", inserted.id);
        results.submitted++;
      } catch (err) {
        console.error(`Failed to process file ${file.name}:`, err);
        await (admin as any).from("transcripts")
          .update({ status: "error", error_message: String(err) })
          .eq("external_id", file.id)
          .eq("source", "google_drive");
        results.errors++;
      }
    }

    await (admin as any).from("polling_cursors").update({
      last_synced_at: new Date().toISOString(),
      status: "idle",
      last_error: null,
    }).eq("source", "drive_transcripts");

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDriveAccessIssue = message.startsWith("Dossier Google Drive inaccessible")
      || message.startsWith("Le dossier Google Drive")
      || message.startsWith("L'identifiant Google Drive");
    console.error("poll-drive-transcripts error:", message);
    await (admin as any).from("polling_cursors")
      .update({ status: "error", last_error: message })
      .eq("source", "drive_transcripts");
    return new Response(JSON.stringify({
      ok: false,
      checked: 0,
      completed: 0,
      submitted: 0,
      errors: isDriveAccessIssue ? 0 : 1,
      warning: isDriveAccessIssue ? message : undefined,
      error: isDriveAccessIssue ? undefined : message,
    }), {
      status: isDriveAccessIssue ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
