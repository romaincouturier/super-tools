/**
 * retry-testimonial-transcript
 *
 * Re-submits a testimonial's Drive video to AssemblyAI. Runs the upload in
 * the background (EdgeRuntime.waitUntil) and returns 202 immediately to avoid
 * the 150s synchronous timeout on large videos.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
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

  const run = async () => {
    try {
      const accessToken = await getValidDriveAccessToken(admin);
      if (!accessToken) throw new Error("No Google Drive access token");

      const uploadUrl = await uploadDriveFileToAssemblyAI(
        row.drive_file_id,
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
        .from("testimonials")
        .update({ metadata: { assemblyai_id: jobId } })
        .eq("id", row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[retry-testimonial-transcript] ${row.id}:`, message);
    }
  };

  const waitUntil = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime?.waitUntil;
  if (waitUntil) waitUntil(run());
  else run().catch(() => {});

  return new Response(
    JSON.stringify({ ok: true, accepted: true, testimonial_id: row.id }),
    {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
