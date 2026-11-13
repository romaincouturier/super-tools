/**
 * submit-drive-transcript
 *
 * Per-file submitter invoked by `poll-drive-transcripts` for each
 * detected Drive file. Streams the file from Google Drive to AssemblyAI
 * and saves the resulting `assemblyai_id`.
 *
 * Each invocation runs in its OWN edge function execution, so a single
 * very large upload can use the full ~400s wall-clock budget without
 * blocking other files. The poller returns immediately after fan-out.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import {
  getDriveVideoMetadata,
  uploadToAssemblyAI,
  getValidDriveAccessToken,
  uploadDriveFileToAssemblyAI,
  submitAssemblyAIJob,
} from "../_shared/google-drive-helper.ts";

import { isCronOrServiceRole } from "../_shared/cron-auth.ts";
import { reportDriveTranscriptionError } from "../_shared/drive-transcription-errors.ts";
import { extractDriveAudioPart } from "../_shared/drive-audio.ts";
import { ASSEMBLY_UPLOAD_MAX_BYTES, ASSEMBLY_MAX_SECONDS, type AudioPart } from "../_shared/drive-transcription.ts";
import { z } from "https://esm.sh/zod@3.25.76";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";
const ASSEMBLYAI_WEBHOOK_SECRET = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";
const ASSEMBLYAI_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/assemblyai-webhook`;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (!(await isCronOrServiceRole(req))) return createErrorResponse("Unauthorized", 401);
  try {
    const parsed = z.object({ transcript_id: z.string().uuid(), drive_file_id: z.string().regex(/^[a-zA-Z0-9_-]+$/) }).safeParse(await req.json());
    if (!parsed.success) return createErrorResponse("Invalid transcript_id or drive_file_id", 400);
    const { transcript_id, drive_file_id } = parsed.data;
    if (!transcript_id || !drive_file_id) {
      return new Response(JSON.stringify({ error: "transcript_id and drive_file_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const run = async () => {
      try {
        const accessToken = await getValidDriveAccessToken(admin);
        if (!accessToken) throw new Error("No Google Drive access token");

        const { data: row, error: rowError } = await admin.from("transcripts").select("metadata,external_id,status,assemblyai_id").eq("id", transcript_id).single();
        if (rowError || !row || row.external_id !== drive_file_id || row.status !== "processing") throw new Error("Transcript Drive introuvable ou incompatible.");
        if (row.assemblyai_id) return;
        const metadata = row.metadata ?? {};
        const file = await getDriveVideoMetadata(drive_file_id, accessToken);
        const expected = Number(file.videoMediaMetadata?.durationMillis ?? 0) / 1000;
        const parts: AudioPart[] = metadata.audio_parts ?? [];
        const needsAudio = Number(file.size) > ASSEMBLY_UPLOAD_MAX_BYTES || expected > ASSEMBLY_MAX_SECONDS || parts.length > 0;
        let part: Awaited<ReturnType<typeof extractDriveAudioPart>> | undefined;
        let uploadUrl: string;
        if (needsAudio) {
          part = await extractDriveAudioPart(drive_file_id, accessToken, Number(file.size), parts.length);
          uploadUrl = await uploadToAssemblyAI(part.bytes, ASSEMBLYAI_API_KEY);
        } else {
          uploadUrl = await uploadDriveFileToAssemblyAI(drive_file_id, accessToken, ASSEMBLYAI_API_KEY);
        }
        const jobId = await submitAssemblyAIJob(
          uploadUrl,
          ASSEMBLYAI_API_KEY,
          !needsAudio && ASSEMBLYAI_WEBHOOK_SECRET
            ? {
                url: ASSEMBLYAI_WEBHOOK_URL,
                authHeaderName: "x-webhook-secret",
                authHeaderValue: ASSEMBLYAI_WEBHOOK_SECRET,
              }
            : undefined,
        );
        if (part) parts.push({ index: parts.length, start: part.start, duration: part.duration, job_id: jobId });
        const { error: savedError } = await admin.from("transcripts").update({
          assemblyai_id: jobId,
          metadata: { ...metadata, drive_size: file.size, expected_duration_seconds: part?.expected ?? expected, audio_parts: parts, audio_total_parts: part?.totalParts ?? 0, submission_started_at: new Date().toISOString() },
        }).eq("id", transcript_id);
        if (savedError) throw new Error(savedError.message);
        console.log("[submit-drive-transcript] job saved", { transcript_id, job_id: jobId, part: parts.length, total_parts: part?.totalParts ?? 0 });
      } catch (err) {
        console.error(`[submit-drive-transcript] ${transcript_id} failed:`, err);
        await reportDriveTranscriptionError(err, { fn: "submit-drive-transcript", transcript_id, drive_file_id });
        await (admin as any)
          .from("transcripts")
          .update({
            status: "error",
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", transcript_id);
      }
    };

    const waitUntil = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil;
    if (waitUntil) waitUntil(run());
    else await run();

    return new Response(JSON.stringify({ accepted: true, transcript_id }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
