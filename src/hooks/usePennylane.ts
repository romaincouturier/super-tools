import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PennylaneRequest {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean>;
  body?: unknown;
}

async function callPennylane<T = unknown>(req: PennylaneRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pennylane-proxy", {
    body: { method: "GET", ...req },
  });
  if (error) throw new Error(error.message || "Erreur Pennylane");
  if (data && typeof data === "object" && "error" in data) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

// ── Types (subset of Pennylane v2) ──────────────────────────────────────────
export interface PennylaneInvoice {
  id: string | number;
  invoice_number?: string;
  label?: string;
  date?: string;
  deadline?: string;
  currency?: string;
  amount?: string | number;
  currency_amount?: string | number;
  currency_amount_before_tax?: string | number;
  amount_before_tax?: string | number;
  paid_amount?: string | number;
  remaining_amount?: string | number;
  status?: string; // "draft" | "paid" | "upcoming" | "late" | ...
  customer?: { id: string | number; name?: string };
  supplier?: { id: string | number; name?: string };
  pdf_url?: string;
  public_url?: string;
}

export interface PennylaneListResponse<T> {
  items?: T[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface PennylaneBankAccount {
  id: string | number;
  name?: string;
  iban?: string;
  bank_name?: string;
  balance?: string | number;
  currency?: string;
  last_sync_at?: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useCustomerInvoices(params: { limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ["pennylane", "customer_invoices", params],
    queryFn: async () => {
      const query: Record<string, string | number> = { per_page: params.limit ?? 50 };
      if (params.status) query.status = params.status;
      return callPennylane<PennylaneListResponse<PennylaneInvoice>>({
        path: "customer_invoices",
        query,
      });
    },
    staleTime: 60 * 1000,
  });
}

export function useSupplierInvoices(params: { limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ["pennylane", "supplier_invoices", params],
    queryFn: async () => {
      const query: Record<string, string | number> = { per_page: params.limit ?? 50 };
      if (params.status) query.status = params.status;
      return callPennylane<PennylaneListResponse<PennylaneInvoice>>({
        path: "supplier_invoices",
        query,
      });
    },
    staleTime: 60 * 1000,
  });
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ["pennylane", "bank_accounts"],
    queryFn: async () =>
      callPennylane<PennylaneListResponse<PennylaneBankAccount>>({
        path: "bank_accounts",
        query: { per_page: 50 },
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateCustomerInvoicePayload {
  customer: { source_id?: string; id?: string | number } | { name: string };
  date: string;
  deadline?: string;
  currency?: string;
  draft?: boolean;
  line_items: Array<{
    label: string;
    quantity: number;
    unit_amount: string | number;
    vat_rate?: string;
    product_id?: string | number;
  }>;
}

export function useCreateCustomerInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCustomerInvoicePayload) =>
      callPennylane<PennylaneInvoice>({
        path: "customer_invoices",
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pennylane", "customer_invoices"] });
    },
  });
}
