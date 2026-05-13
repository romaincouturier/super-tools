/**
 * poll-drive-testimonials
 *
 * Cron function — detects new video testimonials in a Google Drive folder,
 * transcribes them with AssemblyAI, then extracts client name/company/service
 * with Claude and stores them in the testimonials table for review.
 *
 * Same two-pass strategy as poll-drive-transcripts.
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
  extractTestimonialMeta,
  parseTestimonialFilename,
  notifySlack,
} from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";
const ASSEMBLYAI_WEBHOOK_SECRET = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";
const ASSEMBLYAI_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/assemblyai-webhook`;

// Temporary table to track AssemblyAI jobs for testimonials during processing.
// We reuse the polling_cursors metadata column via a simple in-memory approach:
// Each testimonial row stores its assemblyai_id in the metadata JSONB column.

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["google_drive_folder_testimonials", "slack_content_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const folderId = get("google_drive_folder_testimonials");
    const slackChannel = get("slack_content_channel") || "publications-réso-sociaux";

    if (!folderId) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "google_drive_folder_testimonials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ASSEMBLYAI_API_KEY) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "ASSEMBLYAI_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = { checked: 0, completed: 0, submitted: 0, errors: 0, backfilled: 0 };

    // ── Pass 0: backfill drive_file_name + parsed fields for legacy rows ──
    {
      const { data: legacy } = await (admin as any)
        .from("testimonials")
        .select("id, drive_file_id")
        .is("drive_file_name", null);

      const legacyRows = (legacy ?? []) as Array<{ id: string; drive_file_id: string }>;
      if (legacyRows.length > 0) {
        const driveToken = await getValidDriveAccessToken(admin);
        if (driveToken) {
          for (const row of legacyRows) {
            try {
              const r = await fetch(
                `https://www.googleapis.com/drive/v3/files/${row.drive_file_id}?fields=id,name&supportsAllDrives=true`,
                { headers: { Authorization: `Bearer ${driveToken}` } },
              );
              if (!r.ok) continue;
              const f = await r.json() as { name?: string };
              if (!f.name) continue;
              const parsed = parseTestimonialFilename(f.name);
              await (admin as any).from("testimonials").update({
                drive_file_name: f.name,
                client_name: parsed.client_name || null,
                company: parsed.company || null,
                service_type: parsed.service_type || null,
              }).eq("id", row.id);
              results.backfilled++;
            } catch (err) {
              console.warn(`[poll-drive-testimonials] backfill failed for ${row.drive_file_id}:`, err);
            }
          }
        }
      }
    }

    // ── Pass 1: check pending AssemblyAI jobs ────────────────────
    // Testimonials store assemblyai_id in a metadata column
    const { data: processing } = await (admin as any)
      .from("testimonials")
      .select("id, drive_file_id, drive_file_name, client_name, company, service_type, metadata")
      .eq("status", "pending_review")
      .not("metadata->assemblyai_id", "is", null);

    for (const row of (processing ?? []) as Array<{
      id: string;
      drive_file_id: string;
      drive_file_name: string | null;
      client_name: string | null;
      company: string | null;
      service_type: string | null;
      metadata: Record<string, string>;
    }>) {
      const jobId = row.metadata?.assemblyai_id;
      if (!jobId) continue;
      results.checked++;

      const result = await pollAssemblyAIJob(jobId, ASSEMBLYAI_API_KEY);
      if (result === null) continue;
      if (result === "error") {
        await (admin as any).from("testimonials").update({ metadata: {} }).eq("id", row.id);
        results.errors++;
        continue;
      }

      // Prefer values already extracted from filename; fall back to AI only for missing pieces.
      const fromName = parseTestimonialFilename(row.drive_file_name ?? "");
      const haveAll = (row.client_name || fromName.client_name)
        && (row.company || fromName.company)
        && (row.service_type || fromName.service_type);
      const aiMeta = haveAll
        ? { client_name: "", company: "", service_type: "" }
        : await extractTestimonialMeta(result.text);
      const meta = {
        client_name: row.client_name || fromName.client_name || aiMeta.client_name,
        company: row.company || fromName.company || aiMeta.company,
        service_type: row.service_type || fromName.service_type || aiMeta.service_type,
      };

      await (admin as any).from("testimonials").update({
        raw_transcript: result.text,
        client_name: meta.client_name,
        company: meta.company,
        service_type: meta.service_type,
        metadata: {},
      }).eq("id", row.id);
      results.completed++;

      await notifySlack(
        `⭐ *Nouveau témoignage à valider*\n*Client :* ${meta.client_name || "Inconnu"} — ${meta.company || ""}\n*Prestation :* ${meta.service_type || "—"}`,
        slackChannel,
      );
    }

    // ── Pass 2: discover new Drive files ────────────────────────
    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) {
      await (admin as any).from("polling_cursors")
        .update({ status: "error", last_error: "No Drive access token" })
        .eq("source", "drive_testimonials");
      return new Response(
        JSON.stringify({ ...results, warning: "No Google Drive access token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await assertDriveFolderAccessible(folderId, accessToken);

    const { data: cursorRow } = await (admin as any)
      .from("polling_cursors")
      .select("last_synced_at")
      .eq("source", "drive_testimonials")
      .single();

    const modifiedAfter = getModifiedAfterWithLookback(
      (cursorRow as { last_synced_at?: string } | null)?.last_synced_at,
    );

    const { files } = await listDriveFolder(folderId, accessToken, {
      modifiedAfter,
      mimeTypePrefix: "video/",
    });

    const existingIds = files.length > 0
      ? ((await (admin as any).from("testimonials").select("drive_file_id").in("drive_file_id", files.map((f) => f.id))).data ?? [])
          .map((r: { drive_file_id: string }) => r.drive_file_id)
      : [];

    const toProcess = files.filter((f) => !existingIds.includes(f.id)).slice(0, 5);

    const waitUntil = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil;

    // Process SERIALLY to keep memory usage predictable when several large files land at once.
    const processSerially = async () => {
      for (const file of toProcess) {
        try {
          const fromName = parseTestimonialFilename(file.name);
          const { data: inserted, error: insertErr } = await (admin as any)
            .from("testimonials")
            .insert({
              drive_file_id: file.id,
              drive_file_name: file.name,
              status: "pending_review",
              client_name: fromName.client_name || null,
              company: fromName.company || null,
              service_type: fromName.service_type || null,
              metadata: { assemblyai_id: null },
            })
            .select("id")
            .single();

          if (insertErr) {
            console.error(`[poll-drive-testimonials] insert failed for ${file.name}:`, insertErr);
            results.errors++;
            continue;
          }
          if (!inserted) continue;

          const bytes = await downloadDriveFileBytes(file.id, accessToken);
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

          await (admin as any).from("testimonials").update({ metadata: { assemblyai_id: jobId } }).eq("id", inserted.id);
          results.submitted++;
        } catch (err) {
          console.error(`Failed to process testimonial ${file.name}:`, err);
          results.errors++;
        }
      }
    };

    if (waitUntil) waitUntil(processSerially());
    else await processSerially();

    await (admin as any).from("polling_cursors").update({
      last_synced_at: new Date().toISOString(),
      status: "idle",
      last_error: null,
    }).eq("source", "drive_testimonials");

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDriveAccessIssue = message.startsWith("Dossier Google Drive inaccessible")
      || message.startsWith("Le dossier Google Drive")
      || message.startsWith("L'identifiant Google Drive");
    console.error("poll-drive-testimonials error:", message);
    await (admin as any).from("polling_cursors")
      .update({ status: "error", last_error: message })
      .eq("source", "drive_testimonials");
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
