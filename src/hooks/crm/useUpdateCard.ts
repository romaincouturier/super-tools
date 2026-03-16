import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName, normalizeEmail } from "@/lib/stringUtils";
import { logCrmActivity } from "@/services/crmActivity";
import { notifyCrmSlack } from "@/services/crmSlack";
import type { CrmCard, UpdateCardInput } from "@/types/crm";
import { CRM_QUERY_KEY } from "./useCrmMutation";

export const useUpdateCard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id, updates, actorEmail, oldCard,
    }: {
      id: string;
      updates: UpdateCardInput;
      actorEmail: string;
      oldCard: CrmCard;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.first_name !== undefined) updateData.first_name = capitalizeName(updates.first_name as string);
      if (updates.last_name !== undefined) updateData.last_name = capitalizeName(updates.last_name as string);
      if (updates.email !== undefined) updateData.email = normalizeEmail(updates.email as string);
      if (updates.brief_questions !== undefined) updateData.brief_questions = updates.brief_questions as unknown;

      const { error } = await supabase.from("crm_cards").update(updateData).eq("id", id);
      if (error) throw error;

      if (updates.column_id && updates.column_id !== oldCard.column_id) {
        await logCrmActivity(id, "card_moved", actorEmail, oldCard.column_id, updates.column_id);
      }
      if (updates.status_operational && updates.status_operational !== oldCard.status_operational) {
        await logCrmActivity(id, "status_operational_changed", actorEmail, oldCard.status_operational, updates.status_operational);
      }
      if (updates.sales_status && updates.sales_status !== oldCard.sales_status) {
        await logCrmActivity(id, "sales_status_changed", actorEmail, oldCard.sales_status, updates.sales_status);
        if (updates.sales_status === "WON") {
          notifyCrmSlack("opportunity_won", {
            title: oldCard.title,
            company: (updates.company as string) || oldCard.company || undefined,
            first_name: (updates.first_name as string) || oldCard.first_name || undefined,
            last_name: (updates.last_name as string) || oldCard.last_name || undefined,
            service_type: (updates.service_type as string) || oldCard.service_type || undefined,
            estimated_value: (updates.estimated_value as number) ?? oldCard.estimated_value,
            email: (updates.email as string) || oldCard.email || undefined,
          }, actorEmail);
        }
      }
      if (updates.estimated_value !== undefined && updates.estimated_value !== oldCard.estimated_value) {
        await logCrmActivity(id, "estimated_value_changed", actorEmail, String(oldCard.estimated_value), String(updates.estimated_value));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });
};
