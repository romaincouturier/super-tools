import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  notes: string | null;
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
  order_items?: { product_name: string; games?: { title: string } };
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
      const { data, error } = await (supabase as any)
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
      const { data, error } = payload.id
        ? await (supabase as any).from("games").update(payload).eq("id", payload.id).select().single()
        : await (supabase as any).from("games").insert(payload).select().single();
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
      const { error } = await (supabase as any).from("games").delete().eq("id", id);
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
      const { data, error } = await (supabase as any)
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
        ? await (supabase as any).from("game_authors").update(payload).eq("id", payload.id).select().single()
        : await (supabase as any).from("game_authors").insert(payload).select().single();
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
      let q = (supabase as any)
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
      const { data, error } = await (supabase as any)
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

      const { data, error } = await (supabase as any)
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
      const { data: game } = await (supabase as any)
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

      const { data, error } = await (supabase as any)
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
    mutationFn: async (order_item_id: string) => {
      const { data, error } = await (supabase as any).functions.invoke("supertilt-send-email", {
        body: { order_item_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
      qc.invalidateQueries({ queryKey: ["email-log"] });
    },
  });
}

// ── WooCommerce Orders ────────────────────────────────────────────────

export function useWooOrders() {
  return useQuery({
    queryKey: ["woo-orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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
        ? await (supabase as any).from("email_templates").update(payload).eq("id", payload.id).select().single()
        : await (supabase as any)
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
      const { data, error } = await (supabase as any)
        .from("order_email_log")
        .select("*, order_items(product_name, games(title))")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as EmailLog[];
    },
  });
}

// ── Settings ─────────────────────────────────────────────────────────

export function useSupertiltSettings() {
  return useQuery({
    queryKey: ["supertilt-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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
      const { error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
        .from("order_items")
        .select("kanban_status, line_total, game_type, created_at");
      if (error) throw error;

      const items = data as Array<{
        kanban_status: KanbanStatus;
        line_total: number | null;
        game_type: string | null;
        created_at: string;
      }>;

      const total = items.reduce((s, i) => s + (i.line_total ?? 0), 0);
      const toValidate = items.filter((i) => i.kanban_status === "to_validate").length;
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
