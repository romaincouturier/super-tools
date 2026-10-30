/**
 * drive-list-check (diagnostic, read-only)
 *
 * Lists every file in the configured Google Drive transcript folders
 * (no date filter) and returns them with their mimeType, so we can
 * diff against the transcripts table and spot videos never imported.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import {
  getValidDriveAccessToken,
  listDriveFolder,
} from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .eq("setting_key", "google_drive_folder_transcripts");

    const folderIds = ((settingsRows as Array<{ setting_value: string }> | null)?.[0]
      ?.setting_value ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    const accessToken = await getValidDriveAccessToken(admin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No Drive access token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allFiles: Array<{
      id: string;
      name: string;
      mimeType: string;
      createdTime: string;
      modifiedTime: string;
      folderId: string;
    }> = [];

    for (const folderId of folderIds) {
      let pageToken: string | undefined;
      do {
        const { files, nextPageToken } = await listDriveFolder(folderId, accessToken, {
          pageToken,
        });
        for (const f of files) {
          allFiles.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            createdTime: f.createdTime,
            modifiedTime: f.modifiedTime,
            folderId,
          });
        }
        pageToken = nextPageToken;
      } while (pageToken);
    }

    const { data: transcriptRows } = await (admin as any)
      .from("transcripts")
      .select("external_id, status")
      .eq("source", "google_drive");
    const byExternalId = new Map(
      ((transcriptRows as Array<{ external_id: string; status: string }> | null) ?? [])
        .map((r) => [r.external_id, r.status]),
    );

    const videos = allFiles.filter((f) => f.mimeType.startsWith("video/"));
    const missing = videos
      .filter((f) => !byExternalId.has(f.id))
      .map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, folderId: f.folderId }));
    const notReady = videos
      .filter((f) => byExternalId.has(f.id) && byExternalId.get(f.id) !== "ready")
      .map((f) => ({ id: f.id, name: f.name, status: byExternalId.get(f.id) }));

    return new Response(
      JSON.stringify({
        totalFiles: allFiles.length,
        totalVideos: videos.length,
        transcriptsInDb: byExternalId.size,
        missingCount: missing.length,
        missing,
        notReady,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
