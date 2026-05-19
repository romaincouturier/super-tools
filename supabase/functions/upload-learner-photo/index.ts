import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-learner-photo",
    bucket: "learner-photos",
    skipAuth: true,
    validateParams: (form) => {
      const email = String(form.get("email") || "").toLowerCase().trim();
      if (!email || !email.includes("@")) throw new Error("Email invalide");
      return { email };
    },
    buildPath: ({ email }, file) => {
      const slug = email.replace(/[^a-z0-9]/g, "_");
      const ext = file.name.match(/\.[^.]+$/)?.[0] ?? "";
      return `${slug}/avatar_${Date.now()}${sanitizeFileName(ext)}`;
    },
    persist: async (admin, { email }, fileUrl) => {
      const { error } = await admin
        .from("learner_profiles")
        .upsert(
          { email, photo_url: fileUrl, updated_at: new Date().toISOString() },
          { onConflict: "email" },
        );
      if (error) throw new Error(error.message);
      return { url: fileUrl };
    },
  })
);
