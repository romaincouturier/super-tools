import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-trainer-document",
    bucket: "training-documents",
    validateParams: (form) => {
      const trainerId = String(form.get("trainerId") || "");
      if (!trainerId || !UUID.test(trainerId)) throw new Error("trainerId invalide");
      const documentType = String(form.get("documentType") || "autre");
      return { trainerId, documentType };
    },
    buildPath: (_params, file) =>
      `trainers/docs/${Date.now()}_${sanitizeFileName(file.name || "document")}`,
    persist: async (admin, { trainerId, documentType }, fileUrl, _filePath, file, _userId) => {
      const { data: document, error } = await admin
        .from("trainer_documents")
        .insert({
          trainer_id: trainerId,
          file_name: file.name || sanitizeFileName(file.name || "document"),
          file_url: fileUrl,
          document_type: documentType,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { document, fileUrl };
    },
  })
);
