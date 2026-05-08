import { useMemo } from "react";
import { useSupplierInvoices, type PennylaneInvoice } from "@/hooks/usePennylane";

export interface RecurringExpenseCandidate {
  supplierName: string;
  avgAmount: number;
  lastDate: string;
  occurrences: number;
}

function toAmount(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Détecte les fournisseurs facturés au moins 3 fois sur les 12 derniers
 * mois avec un montant qui varie de moins de 10% (charges récurrentes
 * type abonnements, loyer, salaire).
 */
export function useRecurringExpenseDetection() {
  const { data, isLoading } = useSupplierInvoices({ limit: 500 });

  return useMemo<{ loading: boolean; candidates: RecurringExpenseCandidate[] }>(() => {
    const items: PennylaneInvoice[] = data?.items ?? [];
    if (items.length === 0) {
      return { loading: isLoading, candidates: [] };
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recent = items.filter((inv) => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      return Number.isFinite(d.getTime()) && d >= oneYearAgo;
    });

    const bySupplier = new Map<string, { amounts: number[]; lastDate: string }>();
    for (const inv of recent) {
      const name = inv.supplier?.name || inv.label || "Fournisseur inconnu";
      const amount = toAmount(inv.amount);
      if (amount <= 0 || !inv.date) continue;
      const prev = bySupplier.get(name) ?? { amounts: [], lastDate: inv.date };
      prev.amounts.push(amount);
      if (inv.date > prev.lastDate) prev.lastDate = inv.date;
      bySupplier.set(name, prev);
    }

    const candidates: RecurringExpenseCandidate[] = [];
    for (const [supplierName, { amounts, lastDate }] of bySupplier.entries()) {
      if (amounts.length < 3) continue;
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const allWithinTolerance = amounts.every((a) => Math.abs(a - avg) / avg <= 0.1);
      if (!allWithinTolerance) continue;
      candidates.push({ supplierName, avgAmount: avg, lastDate, occurrences: amounts.length });
    }

    candidates.sort((a, b) => b.avgAmount - a.avgAmount);
    return { loading: isLoading, candidates };
  }, [data, isLoading]);
}
