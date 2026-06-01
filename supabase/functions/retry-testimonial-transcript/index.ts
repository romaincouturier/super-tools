/**
 * retry-testimonial-transcript
 *
 * Re-submits a testimonial's Drive video to AssemblyAI when the initial
 * submission failed (raw_transcript is null and metadata.assemblyai_id is null).
 *
 * Body: { testimonial_id: string }
 * Called from the UI "Régénérer le transcript" button and from
 * poll-drive-testimonials to recover stuck rows.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import {
  getValidDriveAccessToken,
  downloadDriveFileBytes,
  uploadToAssemblyAI,
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

  if (!ASSEMBLYAI_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "ASSEMBLYAI_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { testimonial_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  if (!body.testimonial_id) {
    return new Response(JSON.stringify({ ok: false, error: "testimonial_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row, error } = await (admin as any)
    .from("testimonials")
    .select("id, drive_file_id, drive_file_name")
    .eq("id", body.testimonial_id)
    .maybeSingle();

  if (error || !row) {
    return new Response(JSON.stringify({ ok: false, error: "testimonial not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) throw new Error("No Google Drive access token");

    const bytes = await downloadDriveFileBytes(row.drive_file_id, accessToken);
    const uploadUrl = await uploadToAssemblyAI(bytes, ASSEMBLYAI_API_KEY);
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
      .from("testimonials")
      .update({ metadata: { assemblyai_id: jobId } })
      .eq("id", row.id);

    return new Response(JSON.stringify({ ok: true, jobId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[retry-testimonial-transcript] ${row.id}:`, message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
