import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface DevisSnapshot {
  activityLogId: string;
  createdAt: string;
  clientName: string | null;
  recipientEmail: string | null;
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
  shippingFee: number;
  adminFee: number;
  pdfStoragePath: string | null;
}

export interface DevisOrderAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  postcode?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface DevisOrderLine {
  gameId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  isLocation: boolean;
}

export interface CreateDevisOrderInput {
  crmCardId: string;
  devisActivityLogId: string | null;
  customer: { firstName?: string; lastName?: string; email?: string; company?: string };
  billingAddress: DevisOrderAddress;
  shippingAddress: DevisOrderAddress;
  lines: DevisOrderLine[];
  shippingFee: number;
  adminFee: number;
}

export interface OrderableGame {
  id: string;
  title: string;
  game_type: string;
  location_variation_id: number | null;
}

/** Dernier devis de jeux envoyé pour l'opportunité. */
export async function fetchLatestGameDevis(cardId: string): Promise<DevisSnapshot | null> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, created_at, recipient_email, details")
    .eq("action_type", "game_devis_sent")
    .filter("details->>crm_card_id", "eq", cardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = (data.details ?? {}) as Record<string, any>;
  return {
    activityLogId: data.id,
    createdAt: data.created_at,
    clientName: d.client_name ?? null,
    recipientEmail: data.recipient_email ?? null,
    items: Array.isArray(d.items) ? d.items : [],
    shippingFee: Number(d.shipping_fee ?? 0),
    adminFee: Number(d.admin_fee ?? 0),
    pdfStoragePath: d.pdf_storage_path ?? null,
  };
}

export async function fetchOrderableGames(): Promise<OrderableGame[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, title, game_type, location_variation_id")
    .order("title");
  if (error) throw error;
  return (data ?? []) as OrderableGame[];
}

export async function fetchActiveDevisOrder(cardId: string): Promise<{ id: string; order_number: string | null } | null> {
  const { data } = await supabase
    .from("woocommerce_orders")
    .select("id, order_number")
    .eq("crm_card_id", cardId)
    .eq("source", "devis")
    .is("cancelled_at", null)
    .maybeSingle();
  return data ?? null;
}

async function invoke<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("create-devis-order", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try { message = JSON.parse(details).error ?? details; } catch { /* texte brut */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function createDevisOrder(input: CreateDevisOrderInput) {
  return invoke<{ id: string; order_number: string; existing: boolean; emails_queued?: number; auto_send?: boolean }>({ action: "create", ...input });
}

export function cancelDevisOrder(orderId: string, reason: string) {
  return invoke<{ ok: boolean; partners_already_notified?: number }>({ action: "cancel", orderId, reason });
}

/** Rapproche un intitulé de devis d'un jeu du catalogue (insensible casse/accents). */
export function matchGameByTitle(title: string, games: OrderableGame[]): OrderableGame | null {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const t = norm(title);
  return games.find((g) => norm(g.title) === t)
    ?? games.find((g) => t.includes(norm(g.title)) || norm(g.title).includes(t))
    ?? null;
}

/** Lien signé (1 h) vers le PDF du devis rattaché à une commande. */
export async function getDevisPdfUrl(activityLogId: string): Promise<string | null> {
  const { data } = await supabase.from("activity_logs").select("details").eq("id", activityLogId).maybeSingle();
  const details = (data?.details ?? {}) as Record<string, string | null>;
  if (details.pdf_storage_path) {
    const { data: signed } = await supabase.storage.from("devis-pdfs").createSignedUrl(details.pdf_storage_path, 3600);
    if (signed?.signedUrl) return signed.signedUrl;
  }
  return details.pdf_url ?? null;
}
