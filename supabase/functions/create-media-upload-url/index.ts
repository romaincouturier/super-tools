import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "media";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_TYPES = new Set(["mission", "event", "training", "crm", "content", "lms", "agent"]);

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase()
    .slice(0, 180) || "media";
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const sourceType = String(body?.sourceType ?? "").trim();
    const sourceId = String(body?.sourceId ?? "").trim();
    const fileName = String(body?.fileName ?? "").trim();

    if (!SOURCE_TYPES.has(sourceType)) return createErrorResponse("sourceType invalide", 400);
    if (sourceType !== "agent" && !UUID_RE.test(sourceId)) return createErrorResponse("sourceId invalide", 400);
    if (!fileName) return createErrorResponse("fileName requis", 400);

    const safe = sanitizeFileName(fileName);
    const folder = sourceType === "agent" ? `agent/${user.id}` : `${sourceType}/${sourceId}`;
    const path = `${folder}/${Date.now()}_${safe}`;

    const admin = getSupabaseClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) {
      console.error("[create-media-upload-url] error", error);
      return createErrorResponse(error.message, 500);
    }
    const token = (data as { token?: string })?.token;
    if (!token) return createErrorResponse("Token signé manquant", 500);

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
    return createJsonResponse({ path, token, publicUrl: publicData.publicUrl, bucket: BUCKET });
  } catch (err) {
    console.error("[create-media-upload-url] unexpected", err);
    return createErrorResponse("Internal error", 500);
  }
});
