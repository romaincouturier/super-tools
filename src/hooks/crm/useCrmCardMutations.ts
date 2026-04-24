import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logCrmActivity } from "@/services/crmActivity";
import type { OpportunityExtraction } from "@/types/crm";
import { useCrmMutation, CRM_QUERY_KEY } from "./useCrmMutation";

// Re-export split hooks so barrel import stays unchanged
export { useCreateCard } from "./useCreateCard";
export { useUpdateCard } from "./useUpdateCard";

export const useMoveCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId, newColumnId, newPosition, actorEmail, oldColumnId,
    }: {
      cardId: string;
      newColumnId: string;
      newPosition: number;
      actorEmail: string;
      oldColumnId: string;
    }) => {
      const { error } = await supabase
        .from("crm_cards")
        .update({ column_id: newColumnId, position: newPosition })
        .eq("id", cardId);
      if (error) throw error;

      if (newColumnId !== oldColumnId) {
        await logCrmActivity(cardId, "card_moved", actorEmail, oldColumnId, newColumnId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

export const useDeleteCard = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_cards").delete().eq("id", id);
    if (error) throw error;
  }, { successMessage: "Opportunité supprimée" });

export interface ExtractOpportunityInput {
  rawInput: string;
  availableTags: { id: string; name: string; category: string | null }[];
}

export const useExtractOpportunity = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ExtractOpportunityInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Non authentifié");

      const response = await supabase.functions.invoke("crm-extract-opportunity", {
        body: {
          raw_input: input.rawInput,
          available_tags: input.availableTags,
        },
      });
      if (response.error) {
        throw new Error(response.error.message || "Échec de l'extraction");
      }
      return response.data as OpportunityExtraction;
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Erreur d'extraction", description: message, variant: "destructive" });
    },
  });
};
