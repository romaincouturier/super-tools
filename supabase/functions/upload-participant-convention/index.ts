import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-participant-convention",
    bucket: "training-documents",
    validateParams: (form) => {
      const participantId = String(form.get("participantId") || "");
      if (!participantId || !UUID.test(participantId)) throw new Error("participantId invalide");
      const trainingId = String(form.get("trainingId") || "");
      if (!trainingId || !UUID.test(trainingId)) throw new Error("trainingId invalide");
      return { participantId, trainingId };
    },
    buildPath: ({ trainingId, participantId }, file) => {
      const fileExt = file.name.split(".").pop() || "pdf";
      const baseName = file.name.replace(`.${fileExt}`, "");
      return `${trainingId}/participant_${participantId}/convention_signee_${Date.now()}_${sanitizeFileName(baseName)}.${fileExt}`;
    },
    persist: async (admin, { participantId }, fileUrl, _filePath, _file, _userId) => {
      const { error } = await admin
        .from("training_participants")
        .update({ signed_convention_url: fileUrl })
        .eq("id", participantId);
      if (error) throw new Error(error.message || "Erreur de mise à jour");
      return { fileUrl };
    },
  })
);
