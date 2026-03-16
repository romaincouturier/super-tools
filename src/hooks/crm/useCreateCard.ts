import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName, normalizeEmail } from "@/lib/stringUtils";
import { logCrmActivity } from "@/services/crmActivity";
import type { CreateCardInput } from "@/types/crm";
import { CRM_QUERY_KEY } from "./useCrmMutation";

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
