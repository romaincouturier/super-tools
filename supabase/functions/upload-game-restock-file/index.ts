import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-game-restock-file",
    bucket: "game-restock-files",
    validateParams: (form) => {
      const actionId = String(form.get("actionId") || "");
      const gameId = String(form.get("gameId") || "");
      if (!actionId || !UUID.test(actionId)) throw new Error("actionId invalide");
      if (!gameId || !UUID.test(gameId)) throw new Error("gameId invalide");
      return { actionId, gameId };
    },
    buildPath: ({ gameId, actionId }, file) =>
      `${gameId}/${actionId}/${Date.now()}-${sanitizeFileName(file.name || "fichier")}`,
    persist: async (admin, { actionId }, _fileUrl, filePath, file) => {
      const { data, error } = await admin
        .from("game_restock_action_files")
        .insert({
          action_id: actionId,
          file_name: file.name || "fichier",
          file_url: filePath,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message || "Erreur d'enregistrement");
      return { file: data };
    },
  }),
);
