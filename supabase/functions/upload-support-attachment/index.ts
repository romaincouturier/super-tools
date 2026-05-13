import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-support-attachment",
    bucket: "support-attachments",
    validateParams: (form) => {
      const ticketId = String(form.get("ticketId") || "");
      if (!ticketId || !UUID.test(ticketId)) throw new Error("ticketId invalide");
      return { ticketId };
    },
    buildPath: ({ ticketId }, file) =>
      `${ticketId}/${Date.now()}_${sanitizeFileName(file.name || "fichier")}`,
    persist: async (admin, { ticketId }, fileUrl, filePath, file, _userId) => {
      const contentType = file.type || "application/octet-stream";
      const { data: attachment, error } = await admin
        .from("support_ticket_attachments")
        .insert({
          ticket_id: ticketId,
          file_name: file.name || sanitizeFileName(file.name || "fichier"),
          file_path: filePath,
          file_size: file.size,
          mime_type: contentType,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { attachment, fileUrl, isImage: contentType.startsWith("image/") };
    },
  })
);
