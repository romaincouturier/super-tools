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
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import {
  getValidDriveAccessToken,
  uploadDriveFileToAssemblyAI,
  submitAssemblyAIJob,
} from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";
const ASSEMBLYAI_WEBHOOK_SECRET = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";
const ASSEMBLYAI_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/assemblyai-webhook`;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const { transcript_id, drive_file_id } = await req.json();
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

        const uploadUrl = await uploadDriveFileToAssemblyAI(
          drive_file_id,
          accessToken,
          ASSEMBLYAI_API_KEY,
        );
        const jobId = await submitAssemblyAIJob(
          uploadUrl,
          ASSEMBLYAI_API_KEY,
          ASSEMBLYAI_WEBHOOK_SECRET
            ? {
                url: ASSEMBLYAI_WEBHOOK_URL,
                authHeaderName: "x-webhook-secret",
                authHeaderValue: ASSEMBLYAI_WEBHOOK_SECRET,
              }
            : undefined,
        );
        await (admin as any)
          .from("transcripts")
          .update({ assemblyai_id: jobId })
          .eq("id", transcript_id);
      } catch (err) {
        console.error(`[submit-drive-transcript] ${transcript_id} failed:`, err);
        await reportEdgeError(err, { fn: "submit-drive-transcript", itemId: transcript_id });
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
    else run().catch((e) => void reportEdgeError(e, { fn: "submit-drive-transcript", step: "run" }));

    return new Response(JSON.stringify({ accepted: true, transcript_id }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await reportEdgeError(err, { fn: "submit-drive-transcript" });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
