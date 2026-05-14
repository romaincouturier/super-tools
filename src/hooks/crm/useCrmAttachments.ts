import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { CRM_QUERY_KEY } from "./useCrmMutation";

export const useAddAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
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
      return cardId;
    },
    onSuccess: async (cardId) => {
      // Force refetch of the card details (attachments list)
      await queryClient.invalidateQueries({
        queryKey: [CRM_QUERY_KEY, "card-details", cardId],
        refetchType: "active",
      });
      await queryClient.refetchQueries({
        queryKey: [CRM_QUERY_KEY, "card-details", cardId],
        type: "active",
      });
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Fichier ajouté" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toastError(toast, message);
    },
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
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
      return cardId;
    },
    onSuccess: async (cardId) => {
      await queryClient.invalidateQueries({
        queryKey: [CRM_QUERY_KEY, "card-details", cardId],
        refetchType: "active",
      });
      await queryClient.refetchQueries({
        queryKey: [CRM_QUERY_KEY, "card-details", cardId],
        type: "active",
      });
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Fichier supprimé" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toastError(toast, message);
    },
  });
};
