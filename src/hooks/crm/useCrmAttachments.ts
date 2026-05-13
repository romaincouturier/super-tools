import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
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
      const formData = new FormData();
      formData.append("cardId", cardId);
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("upload-crm-attachment", {
        body: formData,
      });

      if (error) throw error;
      if (!data?.attachment) throw new Error("Upload échoué : aucune donnée retournée");

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
