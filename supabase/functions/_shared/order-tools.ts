/**
 * Outil MCP update_order_item : annote une ligne de commande de jeux.
 * Patch partiel (seuls les champs fournis), réponse avant/après. Les gardes DB
 * (location non échue, contrat non signé) s'appliquent tels quels.
 */
import type { AuditFn, Supabase } from "./mission-tools.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ORDER_KANBAN_STATUSES = [
  "to_validate", "received", "to_ship", "dropshipping", "location_pending", "location_active", "processed", "blocked",
];
const COLUMNS =
  "id, wc_order_id, product_name, game_type, kanban_status, validation_status, notes, shipped_confirmed_at, hand_delivered_at, archived_at, updated_at";

export interface OrderItemUpdateInput {
  notes?: unknown;
  kanban_status?: unknown;
  hand_delivered?: unknown;
  shipped_confirmed_at?: unknown;
}

function toTimestamp(v: unknown, field: string): string | null {
  if (v === null) return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new Error(`${field} doit être une date ISO (YYYY-MM-DD ou date-heure) ou null`);
  return d.toISOString();
}

export async function updateOrderItem(
  supabase: Supabase,
  orderItemId: string,
  input: OrderItemUpdateInput,
  audit: AuditFn,
): Promise<string> {
  const id = (orderItemId || "").trim();
  if (!UUID_RE.test(id)) throw new Error("order_item_id doit être un UUID");

  const { data: existing } = await (supabase as any).from("order_items").select(COLUMNS).eq("id", id).maybeSingle();
  if (!existing) throw new Error("Ligne de commande introuvable");

  const patch: Record<string, unknown> = {};
  if (input.notes !== undefined) patch.notes = input.notes === null ? null : String(input.notes).trim() || null;
  if (input.kanban_status !== undefined) {
    if (!ORDER_KANBAN_STATUSES.includes(String(input.kanban_status))) {
      throw new Error(`kanban_status doit valoir : ${ORDER_KANBAN_STATUSES.join(", ")}`);
    }
    patch.kanban_status = input.kanban_status;
  }
  if (input.hand_delivered !== undefined) {
    if (typeof input.hand_delivered === "boolean") {
      patch.hand_delivered_at = input.hand_delivered ? (existing.hand_delivered_at ?? new Date().toISOString()) : null;
    } else {
      patch.hand_delivered_at = toTimestamp(input.hand_delivered, "hand_delivered");
    }
  }
  if (input.shipped_confirmed_at !== undefined) {
    patch.shipped_confirmed_at = toTimestamp(input.shipped_confirmed_at, "shipped_confirmed_at");
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("Aucun champ à modifier : fournir notes, kanban_status, hand_delivered ou shipped_confirmed_at");
  }

  await audit(`update_order_item ${id}: ${Object.keys(patch).join(", ")}`);
  const { data: updated, error } = await (supabase as any)
    .from("order_items").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    before: existing,
    order_item: updated,
    hint: "Seuls les champs fournis ont été modifiés. Une ligne remise en main propre ou expédiée sort des alertes quotidiennes.",
  });
}
