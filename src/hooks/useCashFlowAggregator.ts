import { useMemo } from "react";
import { useCustomerInvoices, useSupplierInvoices, useBankAccounts, type PennylaneInvoice } from "@/hooks/usePennylane";
import { useCashFlowForecast, type CashFlowForecastRow } from "@/hooks/useCashFlowForecast";
import { useCrmPipelineForecast, type CrmPipelineDeal } from "@/hooks/useCrmPipelineForecast";
import { toNumber as toAmount } from "@/lib/financeFormatters";

export interface CashFlowMonthRow {
  month: string; // YYYY-MM
  forecastIncome: number;
  forecastExpense: number;
  realizedIncome: number;
  realizedExpense: number;
  variance: number; // realized net - forecast net
  cumulativeForecastBalance: number;
}

export interface CashFlowAggregation {
  loading: boolean;
  hasError: boolean;
  startingCash: number;
  rows: CashFlowMonthRow[];
}

function monthKey(date: string | undefined): string | null {
  if (!date) return null;
  return date.slice(0, 7);
}

function buildRollingMonths(monthsAhead: number = 11, monthsBehind: number = 0): string[] {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - monthsBehind, 1);
  const months: string[] = [];
  for (let i = 0; i <= monthsAhead + monthsBehind; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function useCashFlowAggregator(): CashFlowAggregation {
  const customerQ = useCustomerInvoices({ limit: 500 });
  const supplierQ = useSupplierInvoices({ limit: 500 });
  const banksQ = useBankAccounts();
  const forecastQ = useCashFlowForecast();
  const pipelineQ = useCrmPipelineForecast();

  return useMemo<CashFlowAggregation>(() => {
    const months = buildRollingMonths(11, 0);
    const rowsByMonth = new Map<string, CashFlowMonthRow>();
    for (const m of months) {
      rowsByMonth.set(m, {
        month: m,
        forecastIncome: 0,
        forecastExpense: 0,
        realizedIncome: 0,
        realizedExpense: 0,
        variance: 0,
        cumulativeForecastBalance: 0,
      });
    }

    // Réalisé : factures Pennylane payées (clients) + factures fournisseurs.
    const customers: PennylaneInvoice[] = customerQ.data?.items ?? [];
    const suppliers: PennylaneInvoice[] = supplierQ.data?.items ?? [];
    for (const inv of customers) {
      if (inv.status !== "paid") continue;
      const key = monthKey(inv.date);
      if (!key) continue;
      const row = rowsByMonth.get(key);
      if (row) row.realizedIncome += toAmount(inv.amount);
    }
    for (const inv of suppliers) {
      const key = monthKey(inv.date);
      if (!key) continue;
      const row = rowsByMonth.get(key);
      if (row) row.realizedExpense += toAmount(inv.amount);
    }

    // Prévisionnel : table cashflow_forecast.
    const forecast: CashFlowForecastRow[] = forecastQ.data ?? [];
    for (const line of forecast) {
      const key = line.month?.slice(0, 7);
      if (!key) continue;
      const row = rowsByMonth.get(key);
      if (!row) continue;
      const amount = Number(line.amount) || 0;
      if (line.type === "income") row.forecastIncome += amount;
      else row.forecastExpense += amount;
    }

    // Pipeline CRM : opportunités OPEN avec expected_close_date.
    const pipeline: CrmPipelineDeal[] = pipelineQ.data ?? [];
    for (const deal of pipeline) {
      const key = deal.expected_close_date.slice(0, 7);
      const row = rowsByMonth.get(key);
      if (!row) continue;
      row.forecastIncome += deal.estimated_value;
    }

    // Variance + cumulative balance.
    const banks = banksQ.data?.items ?? [];
    const startingCash = banks.reduce((s, b) => s + toAmount(b.balance), 0);

    let cumulative = startingCash;
    const ordered = months.map((m) => rowsByMonth.get(m)!);
    for (const row of ordered) {
      const realizedNet = row.realizedIncome - row.realizedExpense;
      const forecastNet = row.forecastIncome - row.forecastExpense;
      row.variance = realizedNet - forecastNet;
      cumulative += forecastNet;
      row.cumulativeForecastBalance = cumulative;
    }

    return {
      loading: customerQ.isLoading || supplierQ.isLoading || forecastQ.isLoading || pipelineQ.isLoading || banksQ.isLoading,
      hasError: Boolean(customerQ.error || supplierQ.error || forecastQ.error || pipelineQ.error || banksQ.error),
      startingCash,
      rows: ordered,
    };
  }, [
    customerQ.data, supplierQ.data, banksQ.data, forecastQ.data, pipelineQ.data,
    customerQ.isLoading, supplierQ.isLoading, banksQ.isLoading, forecastQ.isLoading, pipelineQ.isLoading,
    customerQ.error, supplierQ.error, banksQ.error, forecastQ.error, pipelineQ.error,
  ]);
}
