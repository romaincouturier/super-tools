import { handleFileUpload } from "../_shared/upload-handler.ts";

/**
 * Upload d'un fichier (image/PDF) pour la boîte à idées.
 * Le stockage uniquement : la ligne `ideas` est créée côté client après coup.
 */
Deno.serve((req) =>
  handleFileUpload<{ path: string }>(req, {
    bucket: "ideas",
    name: "upload-idea-file",
    validateParams: (form) => {
      const path = String(form.get("path") || "");
      if (!path) throw new Error("Chemin manquant");
      return { path };
    },
    buildPath: (params) => params.path,
    persist: async (_admin, _params, fileUrl) => ({ publicUrl: fileUrl }),
  }),
);
