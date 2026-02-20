import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { z, parseBody } from "../_shared/validation.ts";

const requestSchema = z.object({
  originalFileName: z.string().min(1),
});

function sanitizeBaseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[()[\]{}]/g, "") // brackets
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 120) || "programme";
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const { data, error } = await parseBody(req, requestSchema);
    if (error) return error;
    const { originalFileName } = data;

    const ext = (originalFileName.split(".").pop() || "pdf").toLowerCase();
    if (ext !== "pdf") return createErrorResponse("Only PDF files are supported", 400);

    const baseName = originalFileName.replace(new RegExp(`\\.${ext}$`, "i"), "");
    const sanitized = sanitizeBaseName(baseName);

    const fileName = `${Date.now()}_${sanitized}.${ext}`;
    const path = `programs/${fileName}`;

    const supabaseAdmin = getSupabaseClient();

    const { data, error } = await supabaseAdmin.storage
      .from("training-programs")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[create-program-upload-url] createSignedUploadUrl error:", error);
      return createErrorResponse(error.message, 500);
    }

    const token = (data as any)?.token as string | undefined;
    if (!token) {
      console.error("[create-program-upload-url] Missing token in response:", data);
      return createErrorResponse("Failed to create signed upload token", 500);
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("training-programs")
      .getPublicUrl(path);

    return createJsonResponse({
      path,
      token,
      publicUrl: publicData.publicUrl,
      userId: user.id,
    });
  } catch (err) {
    console.error("[create-program-upload-url] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
