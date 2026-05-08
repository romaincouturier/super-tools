import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CashFlowType = "income" | "expense";
export type CashFlowSource = "manual" | "crm_deal" | "recurring_detected";

export interface CashFlowForecastRow {
  id: string;
  user_id: string;
  month: string; // ISO date (1er du mois)
  category: string;
  amount: number;
  type: CashFlowType;
  is_recurring: boolean;
  source: CashFlowSource;
  source_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashFlowForecastInput {
  month: string;
  category: string;
  amount: number;
  type: CashFlowType;
  is_recurring?: boolean;
  source?: CashFlowSource;
  source_ref?: string | null;
  notes?: string | null;
}

const QUERY_KEY = ["cashflow_forecast"] as const;

export function useCashFlowForecast() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<CashFlowForecastRow[]> => {
      const { data, error } = await supabase
        .from("cashflow_forecast")
        .select("*")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CashFlowForecastRow[];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateForecastLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CashFlowForecastInput): Promise<CashFlowForecastRow> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Utilisateur non authentifié");
      const { data, error } = await supabase
        .from("cashflow_forecast")
        .insert({
          user_id: userData.user.id,
          month: input.month,
          category: input.category,
          amount: input.amount,
          type: input.type,
          is_recurring: input.is_recurring ?? false,
          source: input.source ?? "manual",
          source_ref: input.source_ref ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CashFlowForecastRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateForecastLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount?: number; category?: string; notes?: string | null }): Promise<void> => {
      const update: Record<string, unknown> = {};
      if (input.amount !== undefined) update.amount = input.amount;
      if (input.category !== undefined) update.category = input.category;
      if (input.notes !== undefined) update.notes = input.notes;
      const { error } = await supabase.from("cashflow_forecast").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteForecastLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("cashflow_forecast").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useCreateForecastLinesBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: CashFlowForecastInput[]): Promise<void> => {
      if (inputs.length === 0) return;
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Utilisateur non authentifié");
      const rows = inputs.map((i) => ({
        user_id: userData.user!.id,
        month: i.month,
        category: i.category,
        amount: i.amount,
        type: i.type,
        is_recurring: i.is_recurring ?? false,
        source: i.source ?? "manual",
        source_ref: i.source_ref ?? null,
        notes: i.notes ?? null,
      }));
      const { error } = await supabase.from("cashflow_forecast").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
