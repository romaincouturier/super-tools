import { useMemo } from "react";
import { useCustomerInvoices, useSupplierInvoices, useBankAccounts, type PennylaneInvoice } from "@/hooks/usePennylane";
import { isFixedCost } from "@/lib/pennylaneCategoryMap";
import { toNumber as toAmount } from "@/lib/financeFormatters";

export interface PeriodRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (inclusive)
}

export interface KPIWithChange {
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
}

export interface MonthlySeriesPoint {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
  margin: number;
}

export interface ExpenseBreakdownSlice {
  name: "Charges fixes" | "Charges variables";
  value: number;
}

export interface FinancialKPIs {
  loading: boolean;
  hasError: boolean;
  errorMessage: string | null;
  revenue: KPIWithChange;
  netResult: KPIWithChange;
  marginRate: KPIWithChange;
  cash: number;
  cashAccountsCount: number;
  monthlySeries: MonthlySeriesPoint[];
  expenseBreakdown: ExpenseBreakdownSlice[];
}

function withinRange(dateStr: string | undefined, range: PeriodRange): boolean {
  if (!dateStr) return false;
  return dateStr >= range.from && dateStr <= range.to;
}

function diffDays(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

function computePreviousRange(range: PeriodRange): PeriodRange {
  const span = diffDays(range.from, range.to);
  const prevTo = new Date(new Date(range.from).getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - span * 86400000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

function sumRevenue(items: PennylaneInvoice[], range: PeriodRange): number {
  return items
    .filter((i) => i.status === "paid" && withinRange(i.date, range))
    .reduce((s, i) => s + toAmount(i.amount), 0);
}

function sumExpenses(items: PennylaneInvoice[], range: PeriodRange): number {
  return items
    .filter((i) => withinRange(i.date, range))
    .reduce((s, i) => s + toAmount(i.amount), 0);
}

function buildMonthlySeries(
  customers: PennylaneInvoice[],
  suppliers: PennylaneInvoice[],
  range: PeriodRange,
): MonthlySeriesPoint[] {
  const start = new Date(range.from);
  const end = new Date(range.to);
  const months = new Map<string, MonthlySeriesPoint>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, { month: key, revenue: 0, expenses: 0, margin: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const inv of customers) {
    if (inv.status !== "paid" || !inv.date) continue;
    const key = inv.date.slice(0, 7);
    const slot = months.get(key);
    if (slot) slot.revenue += toAmount(inv.amount);
  }
  for (const inv of suppliers) {
    if (!inv.date) continue;
    const key = inv.date.slice(0, 7);
    const slot = months.get(key);
    if (slot) slot.expenses += toAmount(inv.amount);
  }
  for (const slot of months.values()) {
    slot.margin = slot.revenue - slot.expenses;
  }
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function buildExpenseBreakdown(suppliers: PennylaneInvoice[], range: PeriodRange): ExpenseBreakdownSlice[] {
  let fixed = 0;
  let variable = 0;
  for (const inv of suppliers) {
    if (!withinRange(inv.date, range)) continue;
    const labels = [inv.label, inv.supplier?.name].filter((s): s is string => Boolean(s));
    const isFixed = labels.some(isFixedCost);
    const amount = toAmount(inv.amount);
    if (isFixed) fixed += amount;
    else variable += amount;
  }
  return [
    { name: "Charges fixes", value: fixed },
    { name: "Charges variables", value: variable },
  ];
}

function asKpi(current: number, previous: number): KPIWithChange {
  const delta = current - previous;
  const pct = previous === 0 ? null : (delta / previous) * 100;
  return { current, previous, delta, pct };
}

export function useFinancialKPIs(period: PeriodRange): FinancialKPIs {
  const customerQ = useCustomerInvoices({ limit: 500 });
  const supplierQ = useSupplierInvoices({ limit: 500 });
  const banksQ = useBankAccounts();

  return useMemo<FinancialKPIs>(() => {
    const customers: PennylaneInvoice[] = customerQ.data?.items ?? [];
    const suppliers: PennylaneInvoice[] = supplierQ.data?.items ?? [];
    const banks = banksQ.data?.items ?? [];

    const previousPeriod = computePreviousRange(period);

    const revenueCurrent = sumRevenue(customers, period);
    const revenuePrevious = sumRevenue(customers, previousPeriod);
    const expensesCurrent = sumExpenses(suppliers, period);
    const expensesPrevious = sumExpenses(suppliers, previousPeriod);
    const netCurrent = revenueCurrent - expensesCurrent;
    const netPrevious = revenuePrevious - expensesPrevious;
    const marginCurrent = revenueCurrent > 0 ? (netCurrent / revenueCurrent) * 100 : 0;
    const marginPrevious = revenuePrevious > 0 ? (netPrevious / revenuePrevious) * 100 : 0;

    const cash = banks.reduce((s, b) => s + toAmount(b.balance), 0);

    const error = customerQ.error || supplierQ.error || banksQ.error;
    const errorMessage = error?.message ?? null;

    return {
      loading: customerQ.isLoading || supplierQ.isLoading || banksQ.isLoading,
      hasError: Boolean(error),
      errorMessage,
      revenue: asKpi(revenueCurrent, revenuePrevious),
      netResult: asKpi(netCurrent, netPrevious),
      marginRate: asKpi(marginCurrent, marginPrevious),
      cash,
      cashAccountsCount: banks.length,
      monthlySeries: buildMonthlySeries(customers, suppliers, period),
      expenseBreakdown: buildExpenseBreakdown(suppliers, period),
    };
  }, [customerQ.data, supplierQ.data, banksQ.data, customerQ.isLoading, supplierQ.isLoading, banksQ.isLoading, customerQ.error, supplierQ.error, banksQ.error, period]);
}

export function periodLast12Months(): PeriodRange {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function periodCurrentYear(): PeriodRange {
  const today = new Date();
  return {
    from: `${today.getFullYear()}-01-01`,
    to: today.toISOString().slice(0, 10),
  };
}

export function periodPreviousYear(): PeriodRange {
  const year = new Date().getFullYear() - 1;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
