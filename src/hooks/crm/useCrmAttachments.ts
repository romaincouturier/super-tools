import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
import { resolveContentType, sanitizeFileName } from "@/lib/file-utils";
import { useCrmMutation } from "./useCrmMutation";

export const useAddAttachment = () =>
  useCrmMutation(
    async ({
      cardId,
      file,
      actorEmail,
    }: {
      cardId: string;
      file: File;
      actorEmail: string;
    }) => {
      const filePath = `${cardId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("crm-attachments")
        .upload(filePath, file, { contentType: resolveContentType(file) });
      if (uploadError) {
        // Don't insert a DB row pointing to a file that doesn't exist in storage.
        console.error("Storage upload failed:", uploadError);
        throw new Error(`Upload du fichier échoué: ${uploadError.message}`);
      }
      const { error } = await supabase.from("crm_attachments").insert({
        card_id: cardId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: resolveContentType(file),
      });
      if (error) throw error;
      await logCrmActivity(cardId, "attachment_added", actorEmail, null, file.name);
    },
    { successMessage: "Fichier ajouté" }
  );

export const useDeleteAttachment = () =>
  useCrmMutation(
    async ({
      id,
      cardId,
      fileName,
      filePath,
      actorEmail,
    }: {
      id: string;
      cardId: string;
      fileName: string;
      filePath: string;
      actorEmail: string;
    }) => {
      await supabase.storage.from("crm-attachments").remove([filePath]);
      const { error } = await supabase
        .from("crm_attachments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await logCrmActivity(cardId, "attachment_removed", actorEmail, fileName, null);
    },
    { successMessage: "Fichier supprimé" }
  );
