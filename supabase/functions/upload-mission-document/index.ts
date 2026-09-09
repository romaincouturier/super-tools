import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { mimeTypeFromFileName } from "../_shared/mime-types.ts";

const BUCKET = "mission-documents";

function isAudioMime(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

function estimateProcessingSeconds(fileSize: number): number {
  const sizeMb = Math.max(1, fileSize / (1024 * 1024));
  return Math.min(900, Math.max(90, Math.round(35 + sizeMb * 8)));
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}


/**
 * iOS déclare les .m4a en `audio/x-m4a`, que la chaîne de transcription ne
 * reconnaît pas : dans ce seul cas on retombe sur l'extension. La table
 * extension → MIME vit dans `_shared/mime-types.ts` (règle [052]).
 */
function resolveMime(declared: string | null | undefined, fileName: string): string {
  const detected = declared?.toLowerCase().split(";")[0].trim();
  if (detected && detected !== "audio/x-m4a") return detected;
  return mimeTypeFromFileName(fileName);
}

async function triggerAudioProcessing(supabaseUrl: string, serviceKey: string, documentId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-mission-audio-transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId }),
    });
    if (!response.ok) console.error("[upload-mission-document] audio processing trigger failed", response.status, await response.text());
  } catch (error) {
    console.error("[upload-mission-document] audio processing trigger error", error);
  }
}

/**
 * Insère la ligne mission_documents pour un objet déjà présent dans le bucket
 * et déclenche la transcription si c'est un audio.
 */
async function registerDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  supabaseUrl: string,
  serviceKey: string,
  args: { missionId: string; path: string; fileName: string; fileSize: number; mimeType: string; userId: string },
): Promise<Response> {
  const isAudio = isAudioMime(args.mimeType);
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(args.path);

  const { data: document, error: insertError } = await admin
    .from("mission_documents")
    .insert({
      mission_id: args.missionId,
      file_name: args.fileName,
      file_url: urlData.publicUrl,
      file_size: args.fileSize,
      mime_type: args.mimeType,
      uploaded_by: args.userId,
      processing_status: isAudio ? "pending" : "none",
      processing_progress: isAudio ? 3 : 0,
      processing_estimated_seconds: isAudio ? estimateProcessingSeconds(args.fileSize) : null,
      processing_updated_at: isAudio ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("[upload-mission-document] db error", insertError);
    await admin.storage.from(BUCKET).remove([args.path]);
    return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500, {
      cause: insertError,
      fn: "upload-mission-document",
    });
  }

  if (isAudio) {
    const job = triggerAudioProcessing(supabaseUrl, serviceKey, document.id);
    const edgeRuntime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    edgeRuntime?.waitUntil(job);
  }

  return createJsonResponse({ document });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user?.id) {
      return createErrorResponse("Authentification requise", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse("Configuration serveur manquante", 500);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    /**
     * Mode JSON en deux temps pour les fichiers volumineux : le corps d'une
     * requête d'edge function est plafonné (~20 Mo), un audio de 84 Mo ne
     * passait donc jamais par le mode multipart. Le client demande une URL
     * signée (`sign`), envoie l'octet directement au stockage, puis fait
     * enregistrer la ligne (`register`).
     */
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const missionId = String(body?.missionId || "");
      const action = String(body?.action || "");
      if (!/^[0-9a-f-]{36}$/i.test(missionId)) return createErrorResponse("Mission invalide", 400);

      if (action === "sign") {
        const fileName = String(body?.fileName || "document");
        const path = `${missionId}/docs/${Date.now()}_${sanitizeFileName(fileName)}`;
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data?.token) {
          console.error("[upload-mission-document] signed url error", error);
          return createErrorResponse(error?.message || "URL signée indisponible", 500, {
            cause: error,
            fn: "upload-mission-document",
          });
        }
        return createJsonResponse({ path, token: data.token, bucket: BUCKET });
      }

      if (action === "register") {
        const path = String(body?.path || "");
        if (!path.startsWith(`${missionId}/docs/`)) return createErrorResponse("Chemin invalide", 400);
        const fileName = String(body?.fileName || "document");
        const fileSize = Number(body?.fileSize) || 0;
        const declaredMime = String(body?.mimeType || "").toLowerCase().split(";")[0].trim();
        const mimeType = resolveMime(declaredMime, fileName);
        return await registerDocument(admin, supabaseUrl, serviceKey, {
          missionId,
          path,
          fileName,
          fileSize,
          mimeType,
          userId: user.id,
        });
      }

      return createErrorResponse("Action inconnue", 400);
    }

    const form = await req.formData();
    const missionId = String(form.get("missionId") || "");
    const file = form.get("file");

    if (!missionId || !/^[0-9a-f-]{36}$/i.test(missionId)) {
      return createErrorResponse("Mission invalide", 400);
    }
    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400);
    }

    const sanitizedName = sanitizeFileName(file.name || "document");
    const mimeType = resolveMime(file.type, file.name);
    const path = `${missionId}/docs/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-mission-document] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500, {
        cause: uploadError,
        fn: "upload-mission-document",
      });
    }

    return await registerDocument(admin, supabaseUrl, serviceKey, {
      missionId,
      path,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      userId: user.id,
    });
  } catch (error) {
    console.error("[upload-mission-document] unexpected error", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "upload-mission-document" },
    );
  }
});
