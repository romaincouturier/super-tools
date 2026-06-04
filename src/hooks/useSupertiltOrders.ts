import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

/**
 * Access Supabase tables that are not yet in the generated types schema.
 * Using a cast here is intentional: these tables exist in the DB but are
 * absent from the auto-generated TypeScript definitions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Types ────────────────────────────────────────────────────────────

export type GameType = "supertilt" | "dropshipping" | "location" | "partner";
export type GameStatus = "active" | "inactive" | "to_check";
export type CommissionType = "percentage" | "fixed" | "formula";

export type KanbanStatus =
  | "to_validate"
  | "received"
  | "to_ship"
  | "dropshipping"
  | "location_pending"
  | "processed"
  | "blocked";

export const KANBAN_COLUMNS: { key: KanbanStatus; label: string }[] = [
  { key: "to_validate", label: "À valider" },
  { key: "received", label: "Reçues" },
  { key: "to_ship", label: "À expédier" },
  { key: "dropshipping", label: "Dropshipping" },
  { key: "location_pending", label: "Location — contrat en attente" },
  { key: "processed", label: "Traitées" },
  { key: "blocked", label: "Bloquées / Erreur" },
];

export interface GameAuthorFull {
  id: string;
  name: string;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  company: string | null;
  royalty_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameFull {
  id: string;
  title: string;
  description: string | null;
  woocommerce_product_id: number | null;
  woocommerce_product_url: string | null;
  game_type: GameType;
  status: GameStatus;
  author_id: string | null;
  secondary_author_email: string | null;
  custom_message: string | null;
  processing_instructions: string | null;
  is_partner: boolean;
  partner_name: string | null;
  partner_email: string | null;
  commission_type: CommissionType | null;
  commission_rate: number | null;
  commission_fixed: number | null;
  commission_formula: string | null;
  include_stripe_fees: boolean;
  cost_price: number | null;
  // Location contract
  location_variation_id: number | null;
  pdfmonkey_template_id: string | null;
  location_duree_libelle: string | null;
  location_duree_jours: number | null;
  location_tarif_retard_mois: number | null;
  location_prix_remplacement: number | null;
  // V3 stock
  min_stock: number | null;
  current_stock: number | null;
  restock_threshold: number | null;
  restock_items: string | null;
  restock_supplier_urls: string | null;
  restock_contact_email: string | null;
  created_at: string;
  updated_at: string;
  game_authors?: GameAuthorFull;
}

export interface WooOrder {
  id: string;
  wc_order_id: number;
  order_number: string | null;
  wc_status: string;
  date_created: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  billing_address: Record<string, string> | null;
  shipping_address: Record<string, string> | null;
  total_ttc: number | null;
  total_tax: number | null;
  shipping_total: number | null;
  payment_method_title: string | null;
  raw_order: Record<string, unknown>;
  created_at: string;
}

export interface OrderItem {
  id: string;
  woocommerce_order_id: string;
  wc_order_id: number;
  wc_product_id: number;
  product_name: string | null;
  game_id: string | null;
  game_type: GameType | null;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
  kanban_status: KanbanStatus;
  block_reason: string | null;
  validation_status: string;
  email_sent_at: string | null;
  email_sent_to: string | null;
  invoice_received_at: string | null;
  shipped_confirmed_at: string | null;
  location_contract_file_url: string | null;
  location_document_id: string | null;
  contrat_reference: string | null;
  notes: string | null;
  commission_amount: number | null;
  raw_line_item: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joins
  woocommerce_orders?: WooOrder;
  games?: GameFull;
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  order_item_id: string | null;
  wc_order_id: number | null;
  template_key: string | null;
  sent_to: string[];
  cc: string[];
  subject: string | null;
  status: "sent" | "failed";
  error: string | null;
  sent_at: string;
  order_items?: {
    product_name: string;
    invoice_received_at: string | null;
    shipped_confirmed_at: string | null;
    games?: { title: string; game_type: GameType | null };
  };
}

export interface SupertiltSetting {
  key: string;
  value: unknown;
}

// ── Games ────────────────────────────────────────────────────────────

export function useGamesFullCatalog() {
  return useQuery({
    queryKey: ["games-full"],
    queryFn: async () => {
      const { data, error } = await db
        .from("games")
        .select("*, game_authors(*)")
        .order("title");
      if (error) throw error;
      return data as GameFull[];
    },
  });
}

export function useUpsertGameFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GameFull> & { title: string }) => {
      // Strip joined relations and read-only fields before upsert
      const { game_authors: _ga, created_at: _ca, updated_at: _ua, ...clean } = payload as Partial<GameFull> & { title: string; id?: string };
      const { data, error } = clean.id
        ? await db.from("games").update(clean).eq("id", clean.id).select().single()
        : await db.from("games").insert(clean).select().single();
      if (error) throw error;
      return data as GameFull;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games-full"] }),
  });
}

export function useDeleteGameFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games-full"] }),
  });
}

// ── Authors ──────────────────────────────────────────────────────────

export function useAuthorsFullList() {
  return useQuery({
    queryKey: ["authors-full"],
    queryFn: async () => {
      const { data, error } = await db
        .from("game_authors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as GameAuthorFull[];
    },
  });
}

export function useUpsertAuthorFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GameAuthorFull> & { name: string }) => {
      const { data, error } = payload.id
        ? await db.from("game_authors").update(payload).eq("id", payload.id).select().single()
        : await db.from("game_authors").insert(payload).select().single();
      if (error) throw error;
      return data as GameAuthorFull;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authors-full"] }),
  });
}

// ── Order Items ──────────────────────────────────────────────────────

export function useOrderItems(kanbanStatus?: KanbanStatus) {
  return useQuery({
    queryKey: ["order-items", kanbanStatus],
    queryFn: async () => {
      let q = db
        .from("order_items")
        .select(`*, woocommerce_orders(*), games(id, title, game_type, game_authors(name))`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (kanbanStatus) q = q.eq("kanban_status", kanbanStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data as OrderItem[];
    },
  });
}

export function useAllOrderItems() {
  return useQuery({
    queryKey: ["order-items-all"],
    queryFn: async () => {
      const { data, error } = await db
        .from("order_items")
        .select(`*, woocommerce_orders(*), games(id, title, game_type, game_authors(name))`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as OrderItem[];
    },
  });
}

export function useUpdateOrderItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      kanban_status,
      block_reason,
      notes,
    }: {
      id: string;
      kanban_status?: KanbanStatus;
      block_reason?: string | null;
      notes?: string;
    }) => {
      const patch: Record<string, unknown> = {};
      if (kanban_status !== undefined) patch.kanban_status = kanban_status;
      if (block_reason !== undefined) patch.block_reason = block_reason;
      if (notes !== undefined) patch.notes = notes;

      const { data, error } = await db
        .from("order_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OrderItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
    },
  });
}

export function useValidateOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, game_id }: { id: string; game_id: string }) => {
      // Load game to determine kanban status
      const { data: game } = await db
        .from("games")
        .select("game_type")
        .eq("id", game_id)
        .single();

      const gameType: GameType = (game as { game_type: GameType })?.game_type ?? "dropshipping";
      const kanbanStatus: KanbanStatus =
        gameType === "supertilt" ? "to_ship" :
        gameType === "dropshipping" ? "dropshipping" :
        gameType === "location" ? "location_pending" :
        "received";

      const { data, error } = await db
        .from("order_items")
        .update({
          game_id,
          game_type: gameType,
          kanban_status: kanbanStatus,
          validation_status: "validated",
          block_reason: null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OrderItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
    },
  });
}

// ── Send email for an order item ─────────────────────────────────────

export function useSendOrderEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: string | { order_item_id: string; template_key?: string }) => {
      const body = typeof params === "string" ? { order_item_id: params } : params;
      const { data, error } = await db.functions.invoke("supertilt-send-email", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
      qc.invalidateQueries({ queryKey: ["email-log"] });
      qc.invalidateQueries({ queryKey: ["order-item-email-log"] });
    },
  });
}

// ── WooCommerce Orders ────────────────────────────────────────────────

export function useWooOrders() {
  return useQuery({
    queryKey: ["woo-orders"],
    queryFn: async () => {
      const { data, error } = await db
        .from("woocommerce_orders")
        .select("*")
        .order("date_created", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as WooOrder[];
    },
  });
}

// ── Email Templates ───────────────────────────────────────────────────

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await db
        .from("email_templates")
        .select("*")
        .order("template_key");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useUpsertEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailTemplate> & { template_key: string }) => {
      const { data, error } = payload.id
        ? await db.from("email_templates").update(payload).eq("id", payload.id).select().single()
        : await db
            .from("email_templates")
            .upsert(payload, { onConflict: "template_key" })
            .select()
            .single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}

// ── Email Log ─────────────────────────────────────────────────────────

export function useEmailLog() {
  return useQuery({
    queryKey: ["email-log"],
    queryFn: async () => {
      const { data, error } = await db
        .from("order_email_log")
        .select("*, order_items(product_name, invoice_received_at, shipped_confirmed_at, games(title, game_type))")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as EmailLog[];
    },
  });
}

export function useOrderItemEmailLog(wcOrderId: number | null | undefined) {
  return useQuery({
    queryKey: ["order-item-email-log", wcOrderId],
    enabled: !!wcOrderId,
    queryFn: async () => {
      const { data, error } = await db
        .from("order_email_log")
        .select("*")
        .eq("wc_order_id", wcOrderId as number)
        .order("sent_at", { ascending: false });
      if (error) {
        console.error("[useOrderItemEmailLog] error", error);
        throw error;
      }
      return data as EmailLog[];
    },
  });
}

// ── Mark order item invoice received / shipment confirmed ────────────

export function useMarkInvoiceReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, received }: { id: string; received: boolean }) => {
      const { error } = await db
        .from("order_items")
        .update({ invoice_received_at: received ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-log"] });
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
    },
  });
}

export function useMarkShippedConfirmed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmed }: { id: string; confirmed: boolean }) => {
      const { error } = await db
        .from("order_items")
        .update({ shipped_confirmed_at: confirmed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-log"] });
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
    },
  });
}

// ── Settings ─────────────────────────────────────────────────────────

export function useSupertiltSettings() {
  return useQuery({
    queryKey: ["supertilt-settings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("supertilt_settings")
        .select("*");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of (data as SupertiltSetting[])) map[row.key] = row.value;
      return map;
    },
  });
}

export function useUpsertSupertiltSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await db
        .from("supertilt_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supertilt-settings"] }),
  });
}

// ── KPIs ─────────────────────────────────────────────────────────────

export function useOrderKpis() {
  return useQuery({
    queryKey: ["order-kpis"],
    queryFn: async () => {
      const { data, error } = await db
        .from("order_items")
        .select("kanban_status, line_total, game_type, created_at, game_id");
      if (error) throw error;

      const items = data as Array<{
        kanban_status: KanbanStatus;
        line_total: number | null;
        game_type: string | null;
        created_at: string;
        game_id: string | null;
      }>;

      const total = items.reduce((s, i) => s + (i.line_total ?? 0), 0);
      const toValidate = items.filter(
        (i) =>
          !i.game_id &&
          (i.kanban_status === "received" || i.kanban_status === "dropshipping"),
      ).length;
      const blocked = items.filter((i) => i.kanban_status === "blocked").length;
      const processed = items.filter((i) => i.kanban_status === "processed").length;

      const byStatus: Record<KanbanStatus, number> = {} as Record<KanbanStatus, number>;
      for (const item of items) {
        byStatus[item.kanban_status] = (byStatus[item.kanban_status] ?? 0) + 1;
      }

      return { total, toValidate, blocked, processed, byStatus, count: items.length };
    },
  });
}

// ════════════════════════════════════════════════════════════════
// V2 — TYPES
// ════════════════════════════════════════════════════════════════

export interface PartnerAccessToken {
  id: string;
  game_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  created_at: string;
  games?: { title: string; partner_name: string | null };
}

export interface PartnerPayment {
  id: string;
  game_id: string;
  amount: number;
  payment_date: string;
  comment: string | null;
  status: "declared" | "verified" | "rejected";
  declared_by: "admin" | "partner";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  games?: { title: string };
}

// V3
export interface GameExpense {
  id: string;
  game_id: string;
  expense_date: string;
  expense_type: string;
  description: string | null;
  supplier: string | null;
  supplier_url: string | null;
  purchased_by: string | null;
  amount_ht: number | null;
  vat_rate: number;
  amount_ttc: number | null;
  quantity: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  games?: { title: string };
}

export const EXPENSE_TYPES = [
  "impression", "cartes", "cubes", "emballage", "enveloppes",
  "frais de livraison", "matériel complémentaire", "autre",
];

// ════════════════════════════════════════════════════════════════
// V2 — PARTNER TOKENS
// ════════════════════════════════════════════════════════════════

export function usePartnerTokens(gameId?: string) {
  return useQuery({
    queryKey: ["partner-tokens", gameId],
    queryFn: async () => {
      let q = db
        .from("partner_access_tokens")
        .select("*, games(title, partner_name)")
        .order("created_at", { ascending: false });
      if (gameId) q = q.eq("game_id", gameId);
      const { data, error } = await q;
      if (error) throw error;
      return data as PartnerAccessToken[];
    },
  });
}

export function useCreatePartnerToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { game_id: string; label?: string; expires_at?: string | null }) => {
      const { data, error } = await db
        .from("partner_access_tokens")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as PartnerAccessToken;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-tokens"] }),
  });
}

export function useDeletePartnerToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("partner_access_tokens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-tokens"] }),
  });
}

// ════════════════════════════════════════════════════════════════
// V2 — PARTNER PAYMENTS (admin side)
// ════════════════════════════════════════════════════════════════

export function usePartnerPayments(gameId?: string) {
  return useQuery({
    queryKey: ["partner-payments", gameId],
    queryFn: async () => {
      let q = db
        .from("partner_payments")
        .select("*, games(title)")
        .order("payment_date", { ascending: false });
      if (gameId) q = q.eq("game_id", gameId);
      const { data, error } = await q;
      if (error) throw error;
      return data as PartnerPayment[];
    },
  });
}

export function useUpsertPartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PartnerPayment> & { game_id: string; amount: number; payment_date: string }) => {
      const { data, error } = payload.id
        ? await db.from("partner_payments").update(payload).eq("id", payload.id).select().single()
        : await db.from("partner_payments").insert(payload).select().single();
      if (error) throw error;
      return data as PartnerPayment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-payments"] }),
  });
}

export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: "verified" | "rejected"; admin_notes?: string }) => {
      const { data, error } = await db
        .from("partner_payments")
        .update({ status, admin_notes: admin_notes ?? null })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as PartnerPayment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-payments"] }),
  });
}

export function useDeletePartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("partner_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-payments"] }),
  });
}

// ════════════════════════════════════════════════════════════════
// V2 — FINANCIAL SUMMARY
// ════════════════════════════════════════════════════════════════

export function useFinancialSummary(gameId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ["financial-summary", gameId, from, to],
    queryFn: async () => {
      // Sales
      let salesQ = db
        .from("order_items")
        .select("game_id, line_total, commission_amount, quantity, games(id, title, game_type, commission_type, commission_rate, commission_fixed, include_stripe_fees, cost_price)")
        .not("kanban_status", "eq", "to_validate");
      if (gameId) salesQ = salesQ.eq("game_id", gameId);
      if (from) salesQ = salesQ.gte("created_at", from);
      if (to) salesQ = salesQ.lte("created_at", to + "T23:59:59Z");
      const { data: salesData, error: salesErr } = await salesQ;
      if (salesErr) throw salesErr;

      // Expenses
      let expQ = db
        .from("game_expenses")
        .select("game_id, amount_ttc, amount_ht");
      if (gameId) expQ = expQ.eq("game_id", gameId);
      if (from) expQ = expQ.gte("expense_date", from.slice(0, 10));
      if (to) expQ = expQ.lte("expense_date", to.slice(0, 10));
      const { data: expData } = await expQ;

      // Payments
      let payQ = db
        .from("partner_payments")
        .select("game_id, amount, status");
      if (gameId) payQ = payQ.eq("game_id", gameId);
      const { data: payData } = await payQ;

      const sales = (salesData ?? []) as Array<Record<string, unknown>>;
      const expenses = (expData ?? []) as Array<{ game_id: string; amount_ttc: number | null; amount_ht: number | null }>;
      const payments = (payData ?? []) as Array<{ game_id: string; amount: number; status: string }>;

      // Aggregate by game
      const byGame = new Map<string, {
        title: string;
        game_type: string;
        cost_price: number;
        sales_count: number;
        total_qty: number;
        total_ttc: number;
        total_commission: number; // ce que SuperTilt gagne (part SuperTilt sur partner/dropshipping)
        partner_payout: number;   // ce qui est dû/versé au partenaire
        total_expenses: number;
        total_paid: number;
      }>();

      for (const s of sales) {
        const g = s.games as Record<string, unknown> | null;
        const gid = (s.game_id as string) ?? "unknown";
        const gameType = (g?.game_type as string) ?? "unknown";
        const isPartnerLike = gameType === "partner" || gameType === "dropshipping";
        const lineTotal = (s.line_total as number) ?? 0;
        const partnerCut = (s.commission_amount as number) ?? 0;
        const qty = (s.quantity as number) ?? 0;
        const supertiltCommission = isPartnerLike ? Math.max(0, lineTotal - partnerCut) : 0;

        const existing = byGame.get(gid) ?? {
          title: (g?.title as string) ?? "Inconnu",
          game_type: gameType,
          cost_price: (g?.cost_price as number) ?? 0,
          sales_count: 0,
          total_qty: 0,
          total_ttc: 0,
          total_commission: 0,
          partner_payout: 0,
          total_expenses: 0,
          total_paid: 0,
        };
        existing.sales_count++;
        existing.total_qty += qty;
        existing.total_ttc += lineTotal;
        existing.total_commission += supertiltCommission;
        existing.partner_payout += isPartnerLike ? partnerCut : 0;
        byGame.set(gid, existing);
      }

      for (const e of expenses) {
        const gid = e.game_id ?? "unknown";
        const existing = byGame.get(gid);
        if (existing) existing.total_expenses += e.amount_ttc ?? 0;
      }

      for (const p of payments) {
        if (p.status !== "verified") continue;
        const gid = p.game_id ?? "unknown";
        const existing = byGame.get(gid);
        if (existing) existing.total_paid += p.amount ?? 0;
      }

      return [...byGame.entries()].map(([id, data]) => {
        const isPartnerLike = data.game_type === "partner" || data.game_type === "dropshipping";
        const cogs = (data.cost_price ?? 0) * data.total_qty;
        // Revenu SuperTilt : pour partner/dropshipping = part SuperTilt ; sinon = CA TTC
        const supertiltRevenue = isPartnerLike ? data.total_commission : data.total_ttc;
        return {
          game_id: id,
          ...data,
          cogs,
          margin: supertiltRevenue - cogs - data.total_expenses,
          commission_remaining: data.partner_payout - data.total_paid,
        };
      });
    },
  });
}

// ════════════════════════════════════════════════════════════════
// V3 — EXPENSES
// ════════════════════════════════════════════════════════════════

export function useGameExpenses(gameId?: string) {
  return useQuery({
    queryKey: ["game-expenses", gameId],
    queryFn: async () => {
      let q = db
        .from("game_expenses")
        .select("*, games(title)")
        .order("expense_date", { ascending: false });
      if (gameId) q = q.eq("game_id", gameId);
      const { data, error } = await q;
      if (error) throw error;
      return data as GameExpense[];
    },
  });
}

export function useUpsertGameExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GameExpense> & { game_id: string; expense_date: string; expense_type: string }) => {
      const { data, error } = payload.id
        ? await db.from("game_expenses").update(payload).eq("id", payload.id).select().single()
        : await db.from("game_expenses").insert(payload).select().single();
      if (error) throw error;
      return data as GameExpense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game-expenses"] }),
  });
}

export function useDeleteGameExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("game_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game-expenses"] }),
  });
}

// ════════════════════════════════════════════════════════════════
// V3 — RESTOCK
// ════════════════════════════════════════════════════════════════

export function useGamesWithStockAlerts() {
  return useQuery({
    queryKey: ["games-stock-alerts"],
    queryFn: async () => {
      const { data, error } = await db
        .from("games")
        .select("id, title, game_type, current_stock, min_stock, restock_threshold, restock_items, restock_supplier_urls, restock_contact_email, game_authors(name, email)")
        .eq("status", "active")
        .not("current_stock", "is", null);
      if (error) throw error;
      const games = (data ?? []) as Array<GameFull>;
      return games.filter((g) =>
        g.current_stock != null &&
        g.min_stock != null &&
        g.current_stock <= g.min_stock
      );
    },
  });
}

export function useSendRestockEmail() {
  return useMutation({
    mutationFn: async ({ game_id, preview = false }: { game_id: string; preview?: boolean }) => {
      const { data, error } = await db.functions.invoke("supertilt-restock-email", {
        body: { game_id, preview },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { ok?: boolean; subject?: string; html?: string; to?: string };
    },
  });
}

// ════════════════════════════════════════════════════════════════
// LOCATION CONTRACT
// ════════════════════════════════════════════════════════════════

export interface LocationContractSignature {
  id: string;
  token: string;
  order_item_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  game_name: string | null;
  contrat_reference: string | null;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  status: "pending" | "signed" | "expired" | "cancelled";
  signed_at: string | null;
  email_sent_at: string | null;
  created_at: string;
}

export function useLocationContractSignature(orderItemId: string | null | undefined) {
  return useQuery({
    queryKey: ["location-contract-signature", orderItemId],
    enabled: !!orderItemId,
    queryFn: async () => {
      const { data, error } = await db
        .from("location_contract_signatures")
        .select("id, token, order_item_id, recipient_email, recipient_name, game_name, contrat_reference, pdf_url, signed_pdf_url, status, signed_at, email_sent_at, created_at")
        .eq("order_item_id", orderItemId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LocationContractSignature | null;
    },
  });
}

export function useGenerateLocationContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderItemId: string) => {
      const { data, error } = await db.functions.invoke("generate-location-contract", {
        body: { orderItemId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { contractUrl: string; documentId: string; contratReference: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
    },
  });
}

export function useSendLocationContractEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderItemId, enableOnlineSignature = true }: { orderItemId: string; enableOnlineSignature?: boolean }) => {
      const { data, error } = await db.functions.invoke("send-location-contract-email", {
        body: { orderItemId, enableOnlineSignature },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; signatureUrl: string; signatureToken: string };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
      qc.invalidateQueries({ queryKey: ["location-contract-signature", variables.orderItemId] });
    },
  });
}

// ════════════════════════════════════════════════════════════════
// CSV EXPORT
// ════════════════════════════════════════════════════════════════

export function useCsvExport() {
  return useCallback((rows: Record<string, unknown>[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(";"),
      ...rows.map((row) =>
        headers.map((h) => {
          const v = row[h];
          if (v == null) return "";
          const s = String(v).replace(/"/g, '""');
          return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
        }).join(";")
      ),
    ];
    const blob = new Blob(["﻿" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
}
