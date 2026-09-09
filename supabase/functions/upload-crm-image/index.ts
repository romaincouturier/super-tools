import { handleFileUpload } from "../_shared/upload-handler.ts";
import { resolveContentType } from "../_shared/file-utils.ts";

/** Un fichier image sans extension connue est traité en PNG, pas en binaire. */
const IMAGE_FALLBACK = "image/png";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-crm-image",
    bucket: "crm-attachments",
    resolveContentType: (file: File) => resolveContentType(file, IMAGE_FALLBACK),
    validateParams: (form) => {
      const cardId = String(form.get("cardId") || "");
      if (!cardId || !UUID.test(cardId)) throw new Error("cardId invalide");
      return { cardId };
    },
    buildPath: ({ cardId }, file) => {
      const ext = resolveContentType(file, IMAGE_FALLBACK).split("/")[1] || "png";
      return `${cardId}/${Date.now()}.${ext}`;
    },
    persist: async (admin, { cardId }, publicUrl, _filePath, file, _userId) => {
      const contentType = resolveContentType(file, IMAGE_FALLBACK);
      const { error } = await admin.from("media").insert({
        file_url: publicUrl,
        file_name: file.name,
        file_type: "image",
        mime_type: contentType,
        file_size: file.size,
        source_type: "crm",
        source_id: cardId,
      });
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { publicUrl };
    },
  })
);
