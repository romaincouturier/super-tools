import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

/**
 * Pièce jointe à un signalement de violence, de harcèlement ou de
 * discrimination (indicateur 12).
 *
 * Contrairement aux autres fonctions d'upload, celle-ci n'est pas ouverte à
 * tout utilisateur authentifié : le registre est réservé aux administrateurs,
 * et une preuve jointe à un signalement l'est autant que le récit. D'où le
 * contrôle explicite dans `authorize`.
 *
 * Le bucket est privé et absent de la sauvegarde Drive : le fichier ne
 * s'atteint que par une URL signée à durée courte.
 */

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-vhd-attachment",
    bucket: "vhd-attachments",
    validateParams: (form) => {
      const reportId = String(form.get("reportId") || "");
      if (!reportId || !UUID.test(reportId)) throw new Error("reportId invalide");
      return { reportId };
    },
    authorize: async (admin, userId) => {
      const { data } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.is_admin === true;
    },
    buildPath: ({ reportId }, file) =>
      `${reportId}/${Date.now()}_${sanitizeFileName(file.name || "piece-jointe")}`,
    persist: async (admin, { reportId }, _fileUrl, filePath, file, userId) => {
      const { data: attachment, error } = await admin
        .from("vhd_report_attachments")
        .insert({
          report_id: reportId,
          file_name: file.name || sanitizeFileName(file.name || "piece-jointe"),
          file_path: filePath,
          file_size: file.size,
          content_type: file.type || "application/octet-stream",
          uploaded_by: userId,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { attachment };
    },
  })
);
