import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmPipelineDeal {
  id: string;
  title: string;
  estimated_value: number;
  expected_close_date: string;
  company: string | null;
}

/**
 * Liste les opportunités CRM ouvertes avec une date de closing
 * prévisionnelle. Utilisé par CashFlowBudget pour intégrer le pipeline
 * commercial dans les recettes prévisionnelles.
 */
export function useCrmPipelineForecast() {
  return useQuery({
    queryKey: ["crm_pipeline_forecast"],
    queryFn: async (): Promise<CrmPipelineDeal[]> => {
      const { data, error } = await supabase
        .from("crm_cards")
        .select("id, title, estimated_value, expected_close_date, company")
        .eq("sales_status", "OPEN")
        .not("expected_close_date", "is", null)
        .order("expected_close_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        estimated_value: Number(row.estimated_value ?? 0),
        expected_close_date: row.expected_close_date as string,
        company: (row.company as string | null) ?? null,
      }));
    },
    staleTime: 60 * 1000,
  });
}
