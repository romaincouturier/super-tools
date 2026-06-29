/**
 * Generic file upload handler for Supabase Edge Functions.
 *
 * Security model (single-tenant app):
 * - All authenticated users have access to all resources (USING (true) RLS policies).
 * - Authorization = verifyAuth() succeeds, i.e. a valid Supabase JWT is present.
 * - Pass `authorize` in config for resource-level checks when needed.
 * - SUPABASE_SERVICE_ROLE_KEY never leaves the server — stays in Deno.env.
 *
 * Failure guarantee: if the DB persist step throws, the uploaded file is removed
 * from storage before returning an error (no orphaned files).
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "./cors.ts";
import { verifyAuth } from "./supabase-client.ts";
import { resolveContentType as defaultResolveContentType } from "./file-utils.ts";
import { reportEdgeError } from "./sentry.ts";

export interface UploadConfig<TParams> {
  /** Storage bucket name. */
  bucket: string;

  /**
   * Parse and validate FormData params. Throw an Error with a user-facing
   * message if validation fails (becomes a 400 response).
   */
  validateParams: (form: FormData) => TParams;

  /** Build the storage path for the file. */
  buildPath: (params: TParams, file: File) => string;

  /**
   * Persist metadata to the database. Throw on error — the handler will
   * roll back the storage upload automatically.
   *
   * @returns The JSON response body sent to the client.
   */
  persist: (
    admin: SupabaseClient,
    params: TParams,
    fileUrl: string,
    filePath: string,
    file: File,
    userId: string,
  ) => Promise<Record<string, unknown>>;

  /**
   * Optional resource-level authorization check. Return false to send 403.
   * Runs after verifyAuth — userId is already confirmed non-null.
   */
  authorize?: (
    admin: SupabaseClient,
    userId: string,
    params: TParams,
  ) => Promise<boolean>;

  /** Override default content-type resolution (e.g. to change the fallback). */
  resolveContentType?: (file: File) => string;

  /** Function name used in error logs. Defaults to "upload-handler". */
  name?: string;

  /**
   * Skip JWT verification — for public/anon endpoints (e.g. learner uploads
   * where no Supabase session exists). userId will be passed as "anon".
   */
  skipAuth?: boolean;
}

export async function handleFileUpload<TParams>(
  req: Request,
  config: UploadConfig<TParams>,
): Promise<Response> {
  const fnName = config.name ?? "upload-handler";

  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    let userId = "anon";
    if (!config.skipAuth) {
      const user = await verifyAuth(req.headers.get("Authorization"));
      if (!user?.id) {
        return createErrorResponse("Authentification requise", 401);
      }
      userId = user.id;
    }

    const form = await req.formData();

    let params: TParams;
    try {
      params = config.validateParams(form);
    } catch (e) {
      return createErrorResponse(
        e instanceof Error ? e.message : "Paramètres invalides",
        400,
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse("Configuration serveur manquante", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (config.authorize) {
      const allowed = await config.authorize(admin, userId, params);
      if (!allowed) {
        return createErrorResponse("Accès refusé", 403);
      }
    }

    const contentType = (config.resolveContentType ?? defaultResolveContentType)(file);
    const filePath = config.buildPath(params, file);

    const { error: uploadError } = await admin.storage
      .from(config.bucket)
      .upload(filePath, file, { contentType, upsert: false });

    if (uploadError) {
      console.error(`[${fnName}] storage error`, uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    // Verify the object was actually written. Protects against silent storage
    // failures that would otherwise leave an orphan DB row pointing nowhere.
    const lastSlash = filePath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
    const base = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    const { data: listed, error: listError } = await admin.storage
      .from(config.bucket)
      .list(dir, { limit: 1, search: base });
    if (listError || !listed?.some((o) => o.name === base)) {
      console.error(`[${fnName}] storage verify failed`, { filePath, listError });
      // Best-effort cleanup in case the object did partially land somewhere.
      await admin.storage.from(config.bucket).remove([filePath]).catch(() => {});
      return createErrorResponse(
        "L'upload a échoué côté stockage (objet absent après écriture). Réessayez.",
        500,
      );
    }

    const { data: urlData } = admin.storage.from(config.bucket).getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    let responseData: Record<string, unknown>;
    try {
      responseData = await config.persist(admin, params, fileUrl, filePath, file, userId);
    } catch (persistError) {
      console.error(`[${fnName}] persist error — rolling back storage`, persistError);
      await reportEdgeError(persistError, { fn: fnName, phase: "persist" });
      await admin.storage.from(config.bucket).remove([filePath]);
      const msg =
        persistError instanceof Error
          ? persistError.message
          : "Erreur d'enregistrement";
      return createErrorResponse(msg, 500);
    }

    return createJsonResponse(responseData);
  } catch (error) {
    console.error(`[${fnName}] unexpected error`, error);
    await reportEdgeError(error, { fn: fnName });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
