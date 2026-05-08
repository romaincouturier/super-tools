import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

export interface MonthlyReportPayload {
  month: string;
  generated_at: string;
  company_name: string | null;
  revenue: number;
  revenue_previous: number;
  expenses: number;
  expenses_previous: number;
  net_result: number;
  net_result_previous: number;
  margin_rate: number;
  margin_rate_previous: number;
  active_customers: number;
  avg_basket: number;
  deals_won_count: number;
  deals_won_value: number;
  pipeline_next_month_value: number;
  pipeline_next_month_count: number;
  highlights: string[];
  monthly_series: Array<{ month: string; revenue: number; expenses: number }>;
}

export interface MonthlyReportRow {
  id: string;
  user_id: string;
  month: string; // YYYY-MM-01
  payload: MonthlyReportPayload;
  generated_at: string;
}

export function useMonthlyReport(month: string | null) {
  return useQuery({
    queryKey: ["monthly_report", month],
    enabled: Boolean(month),
    queryFn: async (): Promise<MonthlyReportRow | null> => {
      if (!month) return null;
      const { data, error } = await supabase
        .from("monthly_reports")
        .select("*")
        .eq("month", `${month}-01`)
        .maybeSingle();
      if (error) throw error;
      return (data as MonthlyReportRow | null) ?? null;
    },
    staleTime: 60 * 1000,
  });
}

export function useGenerateMonthlyReport() {
  const qc = useQueryClient();
  const edge = useEdgeFunction<MonthlyReportPayload>("generate-monthly-report", {
    errorMessage: "Impossible de générer le rapport mensuel",
    successToast: { title: "Rapport généré" },
  });

  const generate = async (month: string) => {
    const result = await edge.invoke({ month });
    if (result) {
      qc.invalidateQueries({ queryKey: ["monthly_report", month] });
    }
    return result;
  };

  return { generate, loading: edge.loading, error: edge.error };
}
