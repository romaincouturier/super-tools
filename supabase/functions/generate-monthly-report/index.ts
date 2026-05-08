// Génère un rapport de pilotage mensuel à la demande.
// - Récupère les factures Pennylane du mois et du mois précédent
// - Récupère les opportunités CRM gagnées (won_at) et le pipeline M+1
// - Calcule les KPI clés et 3 faits marquants
// - Upsert dans monthly_reports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";

interface PennylaneInvoice {
  date?: string;
  amount?: string | number;
  status?: string;
  customer?: { id?: string | number; name?: string };
  supplier?: { id?: string | number; name?: string };
}

interface PennylaneListResponse<T> {
  items?: T[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface ReportPayload {
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

function toAmount(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function pennylaneFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${PENNYLANE_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-Use-2026-API-Changes": "true",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pennylane ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function withinRange(date: string | undefined, from: string, to: string): boolean {
  if (!date) return false;
  return date >= from && date <= to;
}

function sumRevenue(items: PennylaneInvoice[], from: string, to: string): number {
  return items
    .filter((i) => i.status === "paid" && withinRange(i.date, from, to))
    .reduce((s, i) => s + toAmount(i.amount), 0);
}

function sumExpenses(items: PennylaneInvoice[], from: string, to: string): number {
  return items.filter((i) => withinRange(i.date, from, to)).reduce((s, i) => s + toAmount(i.amount), 0);
}

function buildHighlights(p: ReportPayload): string[] {
  const out: string[] = [];
  if (p.revenue_previous > 0) {
    const evol = ((p.revenue - p.revenue_previous) / p.revenue_previous) * 100;
    out.push(`CA ${evol >= 0 ? "en hausse" : "en baisse"} de ${Math.abs(evol).toFixed(1)}% vs mois précédent`);
  }
  if (p.deals_won_count > 0) {
    out.push(`${p.deals_won_count} opportunité(s) gagnée(s) ce mois (${Math.round(p.deals_won_value)} €)`);
  }
  if (p.margin_rate >= 0 && p.margin_rate_previous > 0) {
    const diff = p.margin_rate - p.margin_rate_previous;
    out.push(`Taux de marge à ${p.margin_rate.toFixed(1)}% (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts)`);
  }
  if (p.pipeline_next_month_count > 0) {
    out.push(
      `Pipeline du mois suivant : ${p.pipeline_next_month_count} opportunité(s), valeur estimée ${Math.round(
        p.pipeline_next_month_value,
      )} €`,
    );
  }
  return out.slice(0, 3);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Missing Authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    const body = await req.json().catch(() => ({}));
    const month: string = (body.month || "").toString();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return createErrorResponse("Body must include `month` as YYYY-MM", 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Pennylane token
    const { data: setting } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "pennylane_api_token")
      .maybeSingle();
    const token: string | undefined = setting?.setting_value?.trim();
    if (!token) {
      return createErrorResponse("Token API Pennylane non configuré.", 400);
    }

    const { data: meData } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "pennylane_company_name")
      .maybeSingle();
    const companyName: string | null = meData?.setting_value ?? null;

    // Charger 13 mois de factures pour avoir M-1, M, M+1 et la série
    // mensuelle. Pennylane renvoie tri descendant — limit 500 suffit pour
    // une TPE/PME (sinon paginer plus tard).
    const customersResp = await pennylaneFetch<PennylaneListResponse<PennylaneInvoice>>(
      "customer_invoices?per_page=500",
      token,
    );
    const suppliersResp = await pennylaneFetch<PennylaneListResponse<PennylaneInvoice>>(
      "supplier_invoices?per_page=500",
      token,
    );
    const customers = customersResp.items ?? [];
    const suppliers = suppliersResp.items ?? [];

    const current = monthBounds(month);
    const previousMonth = shiftMonth(month, -1);
    const previous = monthBounds(previousMonth);
    const nextMonth = shiftMonth(month, 1);
    const next = monthBounds(nextMonth);

    const revenue = sumRevenue(customers, current.from, current.to);
    const revenuePrev = sumRevenue(customers, previous.from, previous.to);
    const expenses = sumExpenses(suppliers, current.from, current.to);
    const expensesPrev = sumExpenses(suppliers, previous.from, previous.to);

    const customersInMonth = customers.filter(
      (i) => i.status === "paid" && withinRange(i.date, current.from, current.to),
    );
    const distinctCustomers = new Set(
      customersInMonth.map((i) => String(i.customer?.id ?? i.customer?.name ?? "")).filter(Boolean),
    );
    const avgBasket = customersInMonth.length > 0 ? revenue / customersInMonth.length : 0;

    // CRM deals — won_at ce mois + pipeline M+1.
    // crm_cards est partagé (pas de per-user ownership), service role
    // accède donc à toutes les cartes du tenant unique.
    const { data: wonRows } = await admin
      .from("crm_cards")
      .select("id, estimated_value, won_at")
      .gte("won_at", `${current.from}T00:00:00.000Z`)
      .lte("won_at", `${current.to}T23:59:59.999Z`);
    const wonDeals = (wonRows ?? []).filter((c: { won_at: string | null }) => c.won_at);

    const { data: pipelineRows } = await admin
      .from("crm_cards")
      .select("id, estimated_value, expected_close_date, sales_status")
      .eq("sales_status", "OPEN")
      .gte("expected_close_date", next.from)
      .lte("expected_close_date", next.to);

    const dealsWonCount = wonDeals.length;
    const dealsWonValue = wonDeals.reduce(
      (s: number, d: { estimated_value: number | null }) => s + (Number(d.estimated_value) || 0),
      0,
    );
    const pipelineNextValue = (pipelineRows ?? []).reduce(
      (s: number, d: { estimated_value: number | null }) => s + (Number(d.estimated_value) || 0),
      0,
    );
    const pipelineNextCount = (pipelineRows ?? []).length;

    // Série mensuelle 12 mois
    const series: Array<{ month: string; revenue: number; expenses: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const m = shiftMonth(month, -i);
      const b = monthBounds(m);
      series.push({
        month: m,
        revenue: sumRevenue(customers, b.from, b.to),
        expenses: sumExpenses(suppliers, b.from, b.to),
      });
    }

    const netResult = revenue - expenses;
    const netResultPrev = revenuePrev - expensesPrev;
    const marginRate = revenue > 0 ? (netResult / revenue) * 100 : 0;
    const marginRatePrev = revenuePrev > 0 ? (netResultPrev / revenuePrev) * 100 : 0;

    const payload: ReportPayload = {
      month,
      generated_at: new Date().toISOString(),
      company_name: companyName,
      revenue,
      revenue_previous: revenuePrev,
      expenses,
      expenses_previous: expensesPrev,
      net_result: netResult,
      net_result_previous: netResultPrev,
      margin_rate: marginRate,
      margin_rate_previous: marginRatePrev,
      active_customers: distinctCustomers.size,
      avg_basket: avgBasket,
      deals_won_count: dealsWonCount,
      deals_won_value: dealsWonValue,
      pipeline_next_month_value: pipelineNextValue,
      pipeline_next_month_count: pipelineNextCount,
      highlights: [],
      monthly_series: series,
    };
    payload.highlights = buildHighlights(payload);

    // Upsert
    const monthDate = `${month}-01`;
    const { error: upsertErr } = await admin
      .from("monthly_reports")
      .upsert(
        { user_id: user.id, month: monthDate, payload, generated_at: new Date().toISOString() },
        { onConflict: "user_id,month" },
      );
    if (upsertErr) {
      console.error("[generate-monthly-report] upsert error", upsertErr);
      return createErrorResponse(`Persist failed: ${upsertErr.message}`, 500);
    }

    return createJsonResponse({ result: payload }, 200);
  } catch (err) {
    console.error("[generate-monthly-report] error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
