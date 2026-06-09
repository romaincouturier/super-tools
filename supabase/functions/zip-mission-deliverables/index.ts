/**
 * Stream all deliverables of a mission into a single ZIP archive,
 * upload it to the `mission-media` bucket under a short-lived path,
 * and return a 1h signed URL so the browser can download it natively.
 *
 * Why upload then signed URL (instead of streaming the response body)?
 * - The `supabase.functions.invoke` client buffers responses; streaming
 *   a multi-GB ZIP back through it would defeat the whole point.
 * - A signed URL hands the transfer back to the browser's native
 *   download manager (progress bar, disk streaming, resume on some
 *   browsers).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { BlobWriter, ZipWriter } from "https://deno.land/x/zipjs@v2.7.53/index.js";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

interface Deliverable {
  file_name: string;
  file_url: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { mission_id } = await req.json();
    if (!mission_id) return createErrorResponse("mission_id is required", 400);

    const supabase = getSupabaseClient();

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, title")
      .eq("id", mission_id)
      .single();
    if (missionError || !mission) return createErrorResponse("Mission not found", 404);

    const [{ data: docs }, { data: media }] = await Promise.all([
      supabase
        .from("mission_documents")
        .select("file_name, file_url")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("mission_media")
        .select("file_name, file_url")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true),
    ]);

    const deliverables: Deliverable[] = [
      ...((docs ?? []) as Deliverable[]),
      ...((media ?? []) as Deliverable[]),
    ];

    if (deliverables.length === 0) {
      return createErrorResponse("No deliverables for this mission", 404);
    }

    // Build the ZIP in memory. zipjs streams chunks into the writer as
    // each file is fetched, so peak memory ~= one file at a time plus
    // the final blob (acceptable for typical deliverable bundles).
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"), {
      // STORE for already-compressed media (images/video), DEFLATE for
      // the rest. We let zipjs decide via `level: 0` per-entry below.
    });

    const seen = new Map<string, number>();
    for (const d of deliverables) {
      const resp = await fetch(d.file_url);
      if (!resp.ok || !resp.body) {
        console.warn(`Skipping ${d.file_name}: HTTP ${resp.status}`);
        continue;
      }
      // De-duplicate file names inside the archive.
      let name = d.file_name || "fichier";
      if (seen.has(name)) {
        const n = (seen.get(name) ?? 1) + 1;
        seen.set(name, n);
        const dot = name.lastIndexOf(".");
        name = dot > 0
          ? `${name.slice(0, dot)} (${n})${name.slice(dot)}`
          : `${name} (${n})`;
      } else {
        seen.set(name, 1);
      }
      await zipWriter.add(name, resp.body);
    }

    const zipBlob: Blob = await zipWriter.close();

    const safeTitle = (mission.title || "mission").replace(/[^a-zA-Z0-9._-]+/g, "_");
    const storagePath = `_zips/${mission_id}/${Date.now()}_livrables_${safeTitle}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("mission-media")
      .upload(storagePath, zipBlob, {
        contentType: "application/zip",
        upsert: true,
      });
    if (uploadError) {
      console.error("Upload error:", uploadError);
      return createErrorResponse(`Upload failed: ${uploadError.message}`, 500);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("mission-media")
      .createSignedUrl(storagePath, 60 * 60, {
        download: `livrables_${safeTitle}.zip`,
      });
    if (signError || !signed?.signedUrl) {
      return createErrorResponse(`Sign URL failed: ${signError?.message}`, 500);
    }

    return createJsonResponse({
      success: true,
      url: signed.signedUrl,
      file_count: seen.size,
      size_bytes: zipBlob.size,
    });
  } catch (error) {
    console.error("Error in zip-mission-deliverables:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
});
