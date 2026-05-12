import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-participant-file",
    bucket: "participant-files",
    validateParams: (form) => {
      const trainingId = String(form.get("trainingId") || "");
      if (!trainingId || !UUID.test(trainingId)) throw new Error("Formation invalide");
      const participantId = String(form.get("participantId") || "");
      if (!participantId || !UUID.test(participantId)) throw new Error("Participant invalide");
      return { trainingId, participantId };
    },
    buildPath: ({ trainingId, participantId }, file) =>
      `${trainingId}/participant_${participantId}/fichier_${Date.now()}_${sanitizeFileName(file.name || "fichier")}`,
    persist: async (admin, { participantId }, fileUrl, _filePath, file, _userId) => {
      const { data: participantFile, error } = await admin
        .from("participant_files")
        .insert({ participant_id: participantId, file_url: fileUrl, file_name: file.name })
        .select("id, file_url, file_name, uploaded_at")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { file: participantFile };
    },
  })
);
