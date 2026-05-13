import { handleFileUpload } from "../_shared/upload-handler.ts";
import { sanitizeFileName } from "../_shared/file-utils.ts";

type TrainingArrayField = "signed_convention_urls" | "attendance_sheets_urls";
type TrainingSingleField = "invoice_file_url";
type TrainingField = TrainingArrayField | TrainingSingleField;

const ARRAY_FIELDS: TrainingArrayField[] = ["signed_convention_urls", "attendance_sheets_urls"];
const ALLOWED_FIELDS: TrainingField[] = [...ARRAY_FIELDS, "invoice_file_url"];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-training-document-field",
    bucket: "training-documents",
    validateParams: (form) => {
      const trainingId = String(form.get("trainingId") || "");
      if (!trainingId || !UUID.test(trainingId)) throw new Error("trainingId invalide");
      const field = String(form.get("field") || "") as TrainingField;
      if (!ALLOWED_FIELDS.includes(field)) {
        throw new Error(`field invalide, valeurs acceptées: ${ALLOWED_FIELDS.join(", ")}`);
      }
      const filterPattern = form.get("filterPattern")
        ? String(form.get("filterPattern"))
        : null;
      return { trainingId, field, filterPattern };
    },
    buildPath: ({ trainingId, field }, file) =>
      `${trainingId}/${field}_${Date.now()}_${sanitizeFileName(file.name || "document")}`,
    persist: async (admin, { trainingId, field, filterPattern }, fileUrl, _filePath, _file, _userId) => {
      const isArrayField = (ARRAY_FIELDS as string[]).includes(field);
      let updatePayload: Record<string, unknown>;

      if (isArrayField) {
        const { data: trainingData } = await admin
          .from("trainings")
          .select(field)
          .eq("id", trainingId)
          .single();

        let currentUrls: string[] =
          ((trainingData as Record<string, unknown> | null)?.[field] as string[]) || [];

        if (filterPattern) {
          const oldToRemove = currentUrls.filter((url) => url.includes(filterPattern));
          for (const oldUrl of oldToRemove) {
            try {
              const oldPath = oldUrl.split("/training-documents/").pop();
              if (oldPath) {
                await admin.storage
                  .from("training-documents")
                  .remove([decodeURIComponent(oldPath)]);
              }
            } catch { /* best-effort */ }
          }
          currentUrls = currentUrls.filter((url) => !url.includes(filterPattern));
        }

        updatePayload = { [field]: [...currentUrls, fileUrl] };
      } else {
        updatePayload = { [field]: fileUrl };
      }

      const { error } = await admin
        .from("trainings")
        .update(updatePayload)
        .eq("id", trainingId);
      if (error) throw new Error(error.message || "Erreur de mise à jour");
      return { fileUrl, field };
    },
  })
);
