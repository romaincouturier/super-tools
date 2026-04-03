import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
import { resolveContentType } from "@/lib/file-utils";
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
      const filePath = `${cardId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("crm-attachments")
        .upload(filePath, file);
      if (uploadError) {
        console.warn("Storage upload failed, storing reference only:", uploadError);
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
