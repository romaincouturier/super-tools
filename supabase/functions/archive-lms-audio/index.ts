/**
 * Copie les audios originaux importés dans les leçons e-learning vers une
 * arborescence Google Drive lisible :
 *   SuperTools - Audios e-learning / <Titre du cours> /
 *     2026-10-15 22h44 - <Titre du cours> - <nom d'origine>.m4a
 * Chaque appel traite tous les audios LMS pas encore archivés (rattrapage
 * inclus), dans un budget de temps ; le suivi est dans lms_audio_archives.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createErrorResponse, createJsonResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getValidDriveAccessToken } from "../_shared/google-drive-helper.ts";
import { streamFileToGoogleDrive } from "../_shared/drive-resumable-upload.ts";

const ROOT_SETTING = "lms_audio_archive_folder_id";
const ROOT_NAME = "SuperTools - Audios e-learning";
const BUDGET_MS = 120_000;
const FOLDER_MIME = "application/vnd.google-apps.folder";

function cleanName(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Sans titre";
}

function parisStamp(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}h${p.minute}`;
}

async function driveJson(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function folderUsable(token: string, id: string): Promise<boolean> {
  try {
    const f = await driveJson(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,mimeType,trashed&supportsAllDrives=true`, token);
    return f.mimeType === FOLDER_MIME && !f.trashed;
  } catch { return false; }
}

async function findOrCreateFolder(token: string, name: string, parent?: string): Promise<string> {
  const q = [`name = '${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`, `mimeType = '${FOLDER_MIME}'`, "trashed = false", parent ? `'${parent}' in parents` : "'root' in parents"].join(" and ");
  const list = await driveJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, token);
  if (list.files?.[0]?.id) return list.files[0].id;
  const created = await driveJson("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", token, {
    method: "POST", body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  const pre = handleCorsPreflightIfNeeded(req);
  if (pre) return pre;
  const started = Date.now();

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const isService = auth === `Bearer ${serviceKey}`;
    if (!isService) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
      const { data: staff, error } = await userClient.rpc("is_staff_user");
      if (error || !staff) return createErrorResponse("Non autorisé", 401);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = await getValidDriveAccessToken(admin);
    if (!token) return createErrorResponse("Google Drive non connecté", 503);

    // Dossier racine (créé une fois, mémorisé dans les paramètres)
    const { data: setting } = await admin.from("app_settings").select("setting_value").eq("setting_key", ROOT_SETTING).maybeSingle();
    let rootId = setting?.setting_value as string | undefined;
    if (!rootId || !(await folderUsable(token, rootId))) {
      rootId = await findOrCreateFolder(token, ROOT_NAME);
      await admin.from("app_settings").upsert({ setting_key: ROOT_SETTING, setting_value: rootId, description: "Dossier Google Drive des audios originaux e-learning" }, { onConflict: "setting_key" });
    }

    const { data: done } = await admin.from("lms_audio_archives").select("media_id").not("archived_at", "is", null);
    const doneIds = new Set((done ?? []).map((r: { media_id: string }) => r.media_id));
    const { data: medias, error: mErr } = await admin
      .from("media")
      .select("id, file_url, file_name, mime_type, file_size, source_id, created_at")
      .eq("source_type", "lms").eq("file_type", "audio")
      .order("created_at", { ascending: true });
    if (mErr) throw mErr;
    const pending = (medias ?? []).filter((m: { id: string }) => !doneIds.has(m.id));

    const courseIds = [...new Set(pending.map((m: { source_id: string }) => m.source_id))];
    const { data: courses } = courseIds.length
      ? await admin.from("lms_courses").select("id, title").in("id", courseIds)
      : { data: [] };
    const titles = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
    const folderCache = new Map<string, string>();

    let archived = 0; const errors: string[] = [];
    for (const m of pending) {
      if (Date.now() - started > BUDGET_MS) break;
      const courseTitle = cleanName(titles.get(m.source_id) ?? "Cours supprimé");
      const fileName = `${parisStamp(m.created_at)} - ${courseTitle} - ${cleanName(m.file_name)}`;
      try {
        let folderId = folderCache.get(courseTitle);
        if (!folderId) { folderId = await findOrCreateFolder(token, courseTitle, rootId); folderCache.set(courseTitle, folderId); }

        const match = String(m.file_url).match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
        if (!match) throw new Error("URL de stockage non reconnue");
        const [, bucket, rawPath] = match;
        const path = decodeURIComponent(rawPath);
        const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
        if (sErr || !signed) throw new Error(`Fichier introuvable dans le stockage : ${sErr?.message ?? ""}`);

        let size = Number(m.file_size) || 0;
        if (!size) {
          const head = await fetch(signed.signedUrl, { method: "HEAD" });
          size = Number(head.headers.get("content-length")) || 0;
        }
        if (!size) throw new Error("Taille du fichier inconnue");

        const driveId = await streamFileToGoogleDrive({
          accessToken: token, fileName, mimeType: m.mime_type || "audio/mp4", folderId,
          sourceUrl: signed.signedUrl, totalSize: size, deadline: started + BUDGET_MS + 60_000,
        });
        await admin.from("lms_audio_archives").upsert({
          media_id: m.id, course_id: m.source_id, drive_file_id: driveId, drive_file_name: fileName,
          drive_folder_name: `${ROOT_NAME}/${courseTitle}`, archived_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
        });
        archived++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${m.file_name}: ${msg}`);
        const { data: prev } = await admin.from("lms_audio_archives").select("attempts").eq("media_id", m.id).maybeSingle();
        await admin.from("lms_audio_archives").upsert({
          media_id: m.id, course_id: m.source_id, last_error: msg.slice(0, 500), attempts: (prev?.attempts ?? 0) + 1, updated_at: new Date().toISOString(),
        });
      }
    }

    return createJsonResponse({ archived, remaining: pending.length - archived - errors.length, errors });
  } catch (e) {
    return createErrorResponse(e instanceof Error ? e.message : "Erreur inconnue", 500, { cause: e, fn: "archive-lms-audio" });
  }
});
