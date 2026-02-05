import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";

function sanitizeBaseName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // accents
      .replace(/[()[\]{}]/g, "") // brackets
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "")
      .slice(0, 120) || "image"
  );
}

function inferImageExt(originalFileName: string, mimeType?: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  const fromMime = mimeType ? mimeToExt[mimeType.toLowerCase()] : undefined;
  if (fromMime) return fromMime;

  const parts = originalFileName.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
  const normalized = ext === "jpeg" ? "jpg" : ext;
  return normalized || "png";
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const originalFileName = String(body?.originalFileName ?? "").trim();
    const reviewId = String(body?.reviewId ?? "").trim();
    const mimeType = String(body?.mimeType ?? "").trim();
    const fileBase64 = String(body?.fileBase64 ?? "").trim();

    if (!reviewId) return createErrorResponse("reviewId is required", 400);
    if (!originalFileName) return createErrorResponse("originalFileName is required", 400);

    const ext = inferImageExt(originalFileName, mimeType);
    const allowed = new Set(["png", "jpg", "gif", "webp", "heic", "heif"]);
    if (!allowed.has(ext)) {
      return createErrorResponse("Only image files are supported", 400);
    }

    const baseName = originalFileName.replace(/\.[^.]+$/, "");
    const sanitized = sanitizeBaseName(baseName);

    const fileName = `${Date.now()}_${crypto.randomUUID()}_${sanitized}.${ext}`;
    const path = `reviews/${reviewId}/${fileName}`;

    const supabaseAdmin = getSupabaseClient();

    // If fileBase64 is provided, upload directly with service-role (bypasses RLS entirely)
    if (fileBase64) {
      // Strip data URL prefix if present (e.g. "data:image/png;base64,...")
      const base64Content = fileBase64.includes(",")
        ? fileBase64.split(",")[1]
        : fileBase64;

      const binaryStr = atob(base64Content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const contentType = mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("review-images")
        .upload(path, bytes, { contentType, upsert: false });

      if (uploadError) {
        console.error("[create-review-image-upload-url] direct upload error:", uploadError);
        return createErrorResponse(uploadError.message, 500);
      }

      const { data: publicData } = supabaseAdmin.storage
        .from("review-images")
        .getPublicUrl(path);

      return createJsonResponse({
        path,
        publicUrl: publicData.publicUrl,
        userId: user.id,
        reviewId,
      });
    }

    // Fallback: create signed upload URL (legacy flow)
    const { data, error } = await supabaseAdmin.storage
      .from("review-images")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[create-review-image-upload-url] createSignedUploadUrl error:", error);
      return createErrorResponse(error.message, 500);
    }

    const token = (data as any)?.token as string | undefined;
    if (!token) {
      console.error("[create-review-image-upload-url] Missing token in response:", data);
      return createErrorResponse("Failed to create signed upload token", 500);
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("review-images")
      .getPublicUrl(path);

    return createJsonResponse({
      path,
      token,
      publicUrl: publicData.publicUrl,
      userId: user.id,
      reviewId,
    });
  } catch (err) {
    console.error("[create-review-image-upload-url] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
