import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName, normalizeEmail } from "@/lib/stringUtils";
import { logCrmActivity } from "@/services/crmActivity";
import { notifyCrmSlack } from "@/services/crmSlack";
import type { CrmCard, CreateCardInput, UpdateCardInput } from "@/types/crm";
import { useCrmMutation, CRM_QUERY_KEY } from "./useCrmMutation";

export const useCreateCard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      input,
      actorEmail,
    }: {
      input: CreateCardInput;
      actorEmail: string;
    }) => {
      const { data: cards } = await supabase
        .from("crm_cards")
        .select("position")
        .eq("column_id", input.column_id)
        .order("position", { ascending: false })
        .limit(1);
      const maxPos = cards?.[0]?.position ?? -1;

      const insertData = {
        column_id: input.column_id,
        title: input.title,
        description_html: input.description_html || null,
        status_operational: input.status_operational || "TODAY",
        waiting_next_action_date: input.waiting_next_action_date || null,
        waiting_next_action_text: input.waiting_next_action_text || null,
        sales_status: input.sales_status || "OPEN",
        estimated_value: input.estimated_value ?? 0,
        quote_url: input.quote_url || null,
        position: maxPos + 1,
        first_name: capitalizeName(input.first_name),
        last_name: capitalizeName(input.last_name),
        phone: input.phone || null,
        company: input.company || null,
        email: normalizeEmail(input.email),
        linkedin_url: input.linkedin_url || null,
        service_type: input.service_type || null,
        acquisition_source: input.acquisition_source || null,
        brief_questions: (input.brief_questions || null) as unknown as null,
        raw_input: input.raw_input || null,
      };

      const { data, error } = await supabase
        .from("crm_cards")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      await logCrmActivity(data.id, "card_created", actorEmail, null, input.title);
      return data;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [CRM_QUERY_KEY], exact: true });
      toast({ title: "Opportunit\u00e9 cr\u00e9\u00e9e" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });
};

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
  }, { successMessage: "Opportunit\u00e9 supprim\u00e9e" });

export const useExtractOpportunity = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rawInput: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Non authentifi\u00e9");

      const response = await supabase.functions.invoke("crm-extract-opportunity", {
        body: { raw_input: rawInput },
      });
      if (response.error) throw new Error(response.error.message || "\u00c9chec de l'extraction");
      return response.data as import("@/types/crm").OpportunityExtraction;
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Erreur d'extraction", description: message, variant: "destructive" });
    },
  });
};
