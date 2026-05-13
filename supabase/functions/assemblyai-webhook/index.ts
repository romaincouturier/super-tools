/**
 * assemblyai-webhook
 *
 * Public endpoint called by AssemblyAI when a transcription job reaches a
 * terminal state (`completed` or `error`). Authenticated via a shared secret
 * passed in the `x-webhook-secret` header (configured per-request when the job
 * is submitted by poll-drive-transcripts / poll-drive-testimonials).
 *
 * Looks up either a `transcripts` row (by `assemblyai_id`) or a `testimonials`
 * row (by `metadata->assemblyai_id`) and finalizes it the same way the cron
 * Pass 1 does — so the UI updates within seconds of completion instead of
 * waiting for the next polling tick.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import {
  pollAssemblyAIJob,
  analyzeTranscript,
  extractTestimonialMeta,
  parseTestimonialFilename,
  notifySlack,
} from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // ── Auth ─────────────────────────────────────────────────────
  if (!WEBHOOK_SECRET) {
    console.error("ASSEMBLYAI_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-webhook-secret");
  if (provided !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Parse payload ────────────────────────────────────────────
  let payload: { transcript_id?: string; status?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jobId = payload.transcript_id;
  const status = payload.status;
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing transcript_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[assemblyai-webhook] received jobId=${jobId} status=${status}`);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Resolve which row this job belongs to ────────────────────
  // Try transcripts first
  const { data: trRow } = await (admin as any)
    .from("transcripts")
    .select("id, title")
    .eq("assemblyai_id", jobId)
    .maybeSingle();

  if (trRow) {
    return await finalizeTranscript(admin, jobId, trRow as { id: string; title: string });
  }

  // Then testimonials (assemblyai_id stored in metadata JSONB)
  const { data: tmRows } = await (admin as any)
    .from("testimonials")
    .select("id, drive_file_id, metadata")
    .eq("metadata->>assemblyai_id", jobId)
    .limit(1);

  const tmRow = (tmRows ?? [])[0];
  if (tmRow) {
    return await finalizeTestimonial(admin, jobId, tmRow);
  }

  console.warn(`[assemblyai-webhook] no row found for jobId=${jobId}`);
  return new Response(JSON.stringify({ ok: true, ignored: true, reason: "no matching row" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function finalizeTranscript(
  admin: any,
  jobId: string,
  row: { id: string; title: string },
): Promise<Response> {
  if (!ASSEMBLYAI_API_KEY) {
    return jsonResponse({ ok: false, error: "ASSEMBLYAI_API_KEY missing" }, 500);
  }
  const result = await pollAssemblyAIJob(jobId, ASSEMBLYAI_API_KEY);
  if (result === null) {
    // Shouldn't happen since webhook fires on terminal state, but be safe
    return jsonResponse({ ok: true, pending: true });
  }
  if (result === "error") {
    await admin.from("transcripts").update({
      status: "error",
      error_message: "AssemblyAI transcription failed",
      assemblyai_id: null,
    }).eq("id", row.id);
    return jsonResponse({ ok: true, finalized: "error" });
  }

  const analysis = await analyzeTranscript(result.text);
  await admin.from("transcripts").update({
    status: "ready",
    raw_text: result.text,
    duration_seconds: result.duration,
    summary: analysis.summary,
    tags: analysis.tags,
    assemblyai_id: null,
  }).eq("id", row.id);

  // Read Slack channel from settings (best-effort)
  const { data: chRow } = await admin
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "slack_content_channel")
    .maybeSingle();
  const slackChannel = (chRow?.setting_value as string) || "publications-réso-sociaux";

  await notifySlack(
    `🎤 *Nouveau transcript prêt* : ${row.title || "Sans titre"}\n${analysis.summary}`,
    slackChannel,
  );

  // Trigger RAG indexation
  await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_type: "transcript", source_id: row.id }),
  }).catch(() => {});

  // Trigger AI title generation (best-effort, fire and forget)
  fetch(`${SUPABASE_URL}/functions/v1/generate-transcript-title`, {
    method: "POST",
    headers: {
      "x-internal-secret": SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript_id: row.id }),
  }).catch((e) => console.warn("[assemblyai-webhook] title gen failed", e));

  // Auto-trigger article + LinkedIn post generation (fire and forget — long running)
  for (const kind of ["blog_article", "linkedin_post"] as const) {
    fetch(`${SUPABASE_URL}/functions/v1/generate-transcript-content`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript_id: row.id, kind }),
    }).catch((e) => console.warn(`[assemblyai-webhook] auto-gen ${kind} failed`, e));
  }

  return jsonResponse({ ok: true, finalized: "ready" });
}

async function finalizeTestimonial(
  admin: any,
  jobId: string,
  row: { id: string; drive_file_id: string; metadata: Record<string, unknown> },
): Promise<Response> {
  if (!ASSEMBLYAI_API_KEY) {
    return jsonResponse({ ok: false, error: "ASSEMBLYAI_API_KEY missing" }, 500);
  }
  const result = await pollAssemblyAIJob(jobId, ASSEMBLYAI_API_KEY);
  if (result === null) {
    return jsonResponse({ ok: true, pending: true });
  }
  if (result === "error") {
    await admin.from("testimonials").update({ metadata: {} }).eq("id", row.id);
    return jsonResponse({ ok: true, finalized: "error" });
  }

  const meta = await extractTestimonialMeta(result.text);
  await admin.from("testimonials").update({
    raw_transcript: result.text,
    client_name: meta.client_name,
    company: meta.company,
    service_type: meta.service_type,
    metadata: {},
  }).eq("id", row.id);

  const { data: chRow } = await admin
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "slack_content_channel")
    .maybeSingle();
  const slackChannel = (chRow?.setting_value as string) || "publications-réso-sociaux";

  await notifySlack(
    `⭐ *Nouveau témoignage à valider*\n*Client :* ${meta.client_name || "Inconnu"} — ${meta.company || ""}\n*Prestation :* ${meta.service_type || "—"}`,
    slackChannel,
  );

  return jsonResponse({ ok: true, finalized: "ready" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
