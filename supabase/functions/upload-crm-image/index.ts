import { handleFileUpload } from "../_shared/upload-handler.ts";

const UUID = /^[0-9a-f-]{36}$/i;

function resolveImageContentType(file: File): string {
  if (file.type) return file.type.toLowerCase().split(";")[0].trim();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] || "image/png";
}

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-crm-image",
    bucket: "crm-attachments",
    resolveContentType: resolveImageContentType,
    validateParams: (form) => {
      const cardId = String(form.get("cardId") || "");
      if (!cardId || !UUID.test(cardId)) throw new Error("cardId invalide");
      return { cardId };
    },
    buildPath: ({ cardId }, file) => {
      const ext = resolveImageContentType(file).split("/")[1] || "png";
      return `${cardId}/${Date.now()}.${ext}`;
    },
    persist: async (admin, { cardId }, publicUrl, _filePath, file, _userId) => {
      const contentType = resolveImageContentType(file);
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
