import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-crm-attachment",
    bucket: "crm-attachments",
    validateParams: (form) => {
      const cardId = String(form.get("cardId") || "");
      if (!cardId || !UUID.test(cardId)) throw new Error("cardId invalide");
      return { cardId };
    },
    buildPath: ({ cardId }, file) =>
      `${cardId}/${Date.now()}_${sanitizeFileName(file.name || "fichier")}`,
    persist: async (admin, { cardId }, _fileUrl, filePath, file, _userId) => {
      const { data: attachment, error } = await admin
        .from("crm_attachments")
        .insert({
          card_id: cardId,
          file_name: file.name || sanitizeFileName(file.name || "fichier"),
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { attachment };
    },
  })
);
