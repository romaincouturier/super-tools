import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { resolveContentType, sanitizeFileName } from "../_shared/file-utils.ts";

/**
 * Dépôt manuel d'une pièce du dossier de consultation sur un avis.
 *
 * Le DCE n'est pas récupérable par API : il se retire sur PLACE ou AWS derrière
 * un compte. Ici, l'utilisateur dépose le fichier qu'il vient de télécharger.
 *
 * Le fichier est déposé dans un bucket public — un DCE est déjà publié par
 * l'acheteur — et la ligne garde à la fois l'URL de téléchargement et le chemin
 * de stockage, dont l'analyse a besoin pour retélécharger le fichier.
 */

const BUCKET = "tender-documents";
/** Aligné sur `file_size_limit` du bucket : refuser ici donne un message clair. */
const MAX_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405, { fn: "upload-tender-document" });
  }

  try {
    const user = await verifyAuth(req);
    if (!user?.id) {
      return createErrorResponse("Authentification requise", 401, { fn: "upload-tender-document" });
    }

    const form = await req.formData();
    const tenderId = String(form.get("tenderId") || "");
    const file = form.get("file");

    if (!/^[0-9a-f-]{36}$/i.test(tenderId)) {
      return createErrorResponse("Avis invalide", 400, { fn: "upload-tender-document" });
    }
    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400, { fn: "upload-tender-document" });
    }
    if (file.size > MAX_BYTES) {
      return createErrorResponse(
        `Fichier trop lourd (${Math.round(file.size / 1024 / 1024)} Mo, maximum 25 Mo). ` +
          "Un DCE arrive souvent en archive : déposez les pièces une par une.",
        400,
        { fn: "upload-tender-document" },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse("Configuration serveur manquante", 500, {
        fn: "upload-tender-document",
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // L'avis doit exister : sans ce contrôle, la contrainte de clé étrangère
    // renverrait un message illisible après un upload déjà écrit.
    const { data: tender } = await admin
      .from("tender_opportunities")
      .select("id")
      .eq("id", tenderId)
      .maybeSingle();
    if (!tender) {
      return createErrorResponse("Avis introuvable", 404, { fn: "upload-tender-document" });
    }

    const mimeType = resolveContentType(file);
    const path = `${tenderId}/${Date.now()}_${sanitizeFileName(file.name || "document")}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500, {
        cause: uploadError,
        fn: "upload-tender-document",
      });
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { data: document, error: insertError } = await admin
      .from("tender_documents")
      .insert({
        tender_id: tenderId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_size: file.size,
        mime_type: mimeType,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      // Sans ce retrait, un échec d'insertion laisserait un fichier orphelin
      // dans le bucket, invisible et facturé.
      await admin.storage.from(BUCKET).remove([path]);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500, {
        cause: insertError,
        fn: "upload-tender-document",
      });
    }

    return createJsonResponse({ document });
  } catch (error) {
    return createErrorResponse("Erreur au dépôt du document", 500, {
      cause: error,
      fn: "upload-tender-document",
    });
  }
});
