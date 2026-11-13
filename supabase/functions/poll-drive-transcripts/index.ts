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
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isEmptyOrParasiteTranscript, PARASITE_TRANSCRIPT_ERROR } from "../_shared/transcript-quality.ts";
import {
  assertDriveFolderAccessible,

  getValidDriveAccessToken,
  listDriveFolder,
  pollAssemblyAIJob,
  analyzeTranscript,
  notifySlack,
} from "../_shared/google-drive-helper.ts";

import { discoverDriveVideos, GOOGLE_MEET_ROOT, assembleAudioParts, assertCompleteDuration, type AudioPart } from "../_shared/drive-transcription.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { hasManagedCronCredential, isCronOrServiceRole, isStaffCaller } from "../_shared/cron-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";

// Per-file submission moved to the dedicated `submit-drive-transcript`
// edge function so each upload gets its own ~400s wall-clock budget.

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (!(await hasManagedCronCredential(req)) && !(await isCronOrServiceRole(req)) && !(await isStaffCaller(req, "supertilt_fr"))) {
    return createErrorResponse("Unauthorized", 401);
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["google_drive_folder_transcripts", "slack_content_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    // Plusieurs dossiers possibles, séparés par des virgules
    const folderIds = [...new Set((get("google_drive_folder_transcripts") + "," + GOOGLE_MEET_ROOT)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean))];
    const slackChannel = get("slack_content_channel") || "publications-réso-sociaux";

    if (folderIds.length === 0) {
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
      .select("id, title, assemblyai_id, external_id, metadata")
      .eq("source", "google_drive")
      .eq("status", "processing")
      .not("assemblyai_id", "is", null);

    for (const row of (processing ?? []) as Array<{ id: string; title: string; assemblyai_id: string; external_id: string; metadata: Record<string, any> }>) {
      results.checked++;
      let result = await pollAssemblyAIJob(row.assemblyai_id, ASSEMBLYAI_API_KEY);
      if (result === null) continue; // still in progress
      if (result === "error") {
        await (admin as any).from("transcripts").update({ status: "error", error_message: "AssemblyAI transcription failed (cause et identifiant du job dans Sentry)" }).eq("id", row.id);
        results.errors++;
        continue;
      }

      try {
        const metadata = row.metadata ?? {};
        const parts: AudioPart[] = metadata.audio_parts ?? [];
        if (parts.length) {
          const active = parts.find((p) => p.job_id === row.assemblyai_id);
          if (!active) throw new Error("Morceau actif introuvable.");
          active.text = result.text;
          active.actual_duration = result.duration;
          assertCompleteDuration(active.duration, result.duration);
          const { error } = await admin.from("transcripts").update({ metadata: { ...metadata, audio_parts: parts }, assemblyai_id: null }).eq("id", row.id);
          if (error) throw error;
          if (parts.length < metadata.audio_total_parts) continue;
          result = assembleAudioParts(parts, metadata.expected_duration_seconds);
        } else {
          assertCompleteDuration(Number(metadata.expected_duration_seconds ?? 0), result.duration);
        }
      } catch (err) {
        await admin.from("transcripts").update({ status: "error", error_message: String(err), assemblyai_id: null }).eq("id", row.id);
        await reportEdgeError(err, { fn: "poll-drive-transcripts", transcript_id: row.id });
        results.errors++;
        continue;
      }

      // Auto-trash empty transcripts (no speech detected — not a processing error)
      const isEmpty = !result.text || result.text.trim().length < 10;
      if (!isEmpty && isEmptyOrParasiteTranscript(result.text)) {
        await (admin as any).from("transcripts").update({
          status: "error",
          raw_text: result.text ?? "",
          duration_seconds: result.duration,
          error_message: PARASITE_TRANSCRIPT_ERROR,
          assemblyai_id: null,
        }).eq("id", row.id);
        results.errors++;
        continue;
      }
      if (isEmpty) {
        await (admin as any).from("transcripts").update({
          status: "trashed",
          raw_text: result.text ?? "",
          duration_seconds: result.duration,
          summary: "Transcript vide (aucune parole détectée) — mis automatiquement à la corbeille.",
          assemblyai_id: null,
        }).eq("id", row.id);
        results.completed++;
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

      // Trigger AI title generation (best-effort, fire and forget)
      fetch(`${SUPABASE_URL}/functions/v1/generate-transcript-title`, {
        method: "POST",
        headers: { "x-internal-secret": SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_id: row.id }),
      }).catch((e) => console.warn("[poll-drive-transcripts] title gen failed", e));

      // Fiche éditoriale IA (ST-2026-0215, fire and forget)
      fetch(`${SUPABASE_URL}/functions/v1/analyze-transcript-editorial`, {
        method: "POST",
        headers: { "x-internal-secret": SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_id: row.id }),
      }).catch((e) => console.warn("[poll-drive-transcripts] editorial analysis failed", e));

      // Auto-trigger article + LinkedIn post generation (fire and forget — long running)
      for (const kind of ["blog_article", "linkedin_post"] as const) {
        fetch(`${SUPABASE_URL}/functions/v1/generate-transcript-content`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ transcript_id: row.id, kind }),
        }).catch((e) => console.warn(`[poll-drive-transcripts] auto-gen ${kind} failed`, e));
      }
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

    for (const folderId of folderIds) {
      await assertDriveFolderAccessible(folderId, accessToken);
    }

    // Full inventory: old nested recordings and files beyond the five-per-run batch must remain discoverable.
    const files = await discoverDriveVideos(folderIds, (folderId, pageToken) => listDriveFolder(folderId, accessToken, { pageToken }));

    // Filter to files not already queued, while retrying stuck rows with no AssemblyAI job.
    const existingRows: Array<{ id: string; external_id: string; status: string; assemblyai_id: string | null; metadata: any; updated_at: string }> = [];
    for (let offset = 0; offset < files.length; offset += 100) {
      const { data, error } = await admin.from("transcripts").select("id, external_id, status, assemblyai_id, metadata, updated_at").eq("source", "google_drive").in("external_id", files.slice(offset, offset + 100).map((f) => f.id));
      if (error) throw error;
      existingRows.push(...(data ?? []));
    }
    const existingByExternalId = new Map(existingRows.map((row) => [row.external_id, row]));

    const toProcess = files.filter((file) => {
      const existing = existingByExternalId.get(file.id);
      return !existing || (existing.status === "processing" && !existing.assemblyai_id && Date.now() - new Date(existing.updated_at).getTime() > 10 * 60 * 1000);
    }).slice(0, 5);



    // Fan-out: each file is submitted by its OWN edge function execution
    // (`submit-drive-transcript`) so a slow streaming upload of a very
    // large file cannot eat the whole budget and starve the others.
    for (const file of toProcess) {
      try {
        const existing = existingByExternalId.get(file.id);
        const { data: inserted } = existing
          ? await (admin as any)
              .from("transcripts")
              .update({ title: file.name, status: "processing", error_message: null, assemblyai_id: null })
              .eq("id", existing.id)
              .select("id")
              .single()
          : await (admin as any)
              .from("transcripts")
              .insert({ source: "google_drive", external_id: file.id, title: file.name, status: "processing" })
              .select("id")
              .single();

        if (!inserted) continue;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-drive-transcript`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ transcript_id: inserted.id, drive_file_id: file.id }),
        });
        if (!response.ok) throw new Error(`submit-drive-transcript ${response.status}: ${await response.text()}`);

        results.submitted++;
      } catch (err) {
        console.error(`Failed to enqueue file ${file.name}:`, err);
        await reportEdgeError(err, { fn: "poll-drive-transcripts", drive_file_id: file.id });
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
    await reportEdgeError(err, { fn: "poll-drive-transcripts" });
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
