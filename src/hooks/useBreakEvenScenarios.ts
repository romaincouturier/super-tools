import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierInvoices, type PennylaneInvoice } from "@/hooks/usePennylane";
import { isFixedCost } from "@/lib/pennylaneCategoryMap";

export interface BreakEvenScenario {
  id: string;
  user_id: string;
  name: string;
  fixed_costs: number;
  variable_cost_rate: number;
  avg_unit_price: number;
  monthly_units: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveBreakEvenScenarioInput {
  id?: string;
  name: string;
  fixed_costs: number;
  variable_cost_rate: number;
  avg_unit_price: number;
  monthly_units: number;
  notes?: string | null;
}

const QUERY_KEY = ["breakeven_scenarios"] as const;

export function useBreakEvenScenarios() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<BreakEvenScenario[]> => {
      const { data, error } = await supabase
        .from("breakeven_scenarios")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BreakEvenScenario[];
    },
    staleTime: 30 * 1000,
  });
}

export function useSaveBreakEvenScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveBreakEvenScenarioInput): Promise<BreakEvenScenario> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Utilisateur non authentifié");

      if (input.id) {
        const { data, error } = await supabase
          .from("breakeven_scenarios")
          .update({
            name: input.name,
            fixed_costs: input.fixed_costs,
            variable_cost_rate: input.variable_cost_rate,
            avg_unit_price: input.avg_unit_price,
            monthly_units: input.monthly_units,
            notes: input.notes ?? null,
          })
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as BreakEvenScenario;
      }

      const { data, error } = await supabase
        .from("breakeven_scenarios")
        .insert({
          user_id: userData.user.id,
          name: input.name,
          fixed_costs: input.fixed_costs,
          variable_cost_rate: input.variable_cost_rate,
          avg_unit_price: input.avg_unit_price,
          monthly_units: input.monthly_units,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BreakEvenScenario;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteBreakEvenScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("breakeven_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export interface DetectedFixedCost {
  supplierName: string;
  monthlyAverage: number;
  occurrences: number;
}

export interface DetectedFixedCostsResult {
  loading: boolean;
  totalMonthly: number;
  details: DetectedFixedCost[];
}

/**
 * Estime les charges fixes mensuelles à partir des 6 derniers mois
 * de factures fournisseurs Pennylane. Filtre par mots-clés (loyer,
 * abonnement, salaire, etc.) puis moyenne par fournisseur.
 */
export function useDetectedFixedCosts(): DetectedFixedCostsResult {
  const { data, isLoading } = useSupplierInvoices({ limit: 500 });

  return useMemo<DetectedFixedCostsResult>(() => {
    const items: PennylaneInvoice[] = data?.items ?? [];
    if (items.length === 0) {
      return { loading: isLoading, totalMonthly: 0, details: [] };
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recent = items.filter((inv) => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      return Number.isFinite(d.getTime()) && d >= sixMonthsAgo;
    });

    const fixed = recent.filter((inv) => {
      const labels = [inv.label, inv.supplier?.name].filter((s): s is string => Boolean(s));
      return labels.some(isFixedCost);
    });

    const bySupplier = new Map<string, { total: number; count: number }>();
    for (const inv of fixed) {
      const name = inv.supplier?.name || inv.label || "Fournisseur inconnu";
      const amount = typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount ?? 0;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const prev = bySupplier.get(name) ?? { total: 0, count: 0 };
      bySupplier.set(name, { total: prev.total + amount, count: prev.count + 1 });
    }

    const details: DetectedFixedCost[] = Array.from(bySupplier.entries())
      .map(([supplierName, { total, count }]) => ({
        supplierName,
        monthlyAverage: total / 6,
        occurrences: count,
      }))
      .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

    const totalMonthly = details.reduce((s, d) => s + d.monthlyAverage, 0);

    return { loading: isLoading, totalMonthly, details };
  }, [data, isLoading]);
}
