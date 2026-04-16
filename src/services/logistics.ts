import { supabase } from "@/integrations/supabase/client";
import type { LogisticsChecklistItem, LogisticsEntityType, LogisticsTemplateItem, LogisticsTemplates } from "@/types/logistics";

const TABLE = "logistics_checklist_items";

const sb = supabase as unknown as {
  from: (t: string) => {
    select: (cols?: string) => any;
    insert: (data: unknown) => any;
    update: (data: unknown) => any;
    delete: () => any;
  };
};

export async function fetchItems(entityType: LogisticsEntityType, entityId: string): Promise<LogisticsChecklistItem[]> {
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []) as LogisticsChecklistItem[];
}

export async function createItem(input: {
  entity_type: LogisticsEntityType;
  entity_id: string;
  label: string;
  position?: number;
  due_date?: string | null;
  notify_days_before?: number | null;
  legacy_field?: string | null;
}): Promise<LogisticsChecklistItem> {
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      ...input,
      is_done: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LogisticsChecklistItem;
}

export async function updateItem(id: string, updates: Partial<LogisticsChecklistItem>): Promise<LogisticsChecklistItem> {
  const { data, error } = await sb
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LogisticsChecklistItem;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Insert a batch of items in one round-trip. */
export async function createItemsBatch(items: Array<{
  entity_type: LogisticsEntityType;
  entity_id: string;
  label: string;
  position: number;
  legacy_field?: string | null;
  due_date?: string | null;
  notify_days_before?: number | null;
}>): Promise<void> {
  if (!items.length) return;
  const { error } = await sb.from(TABLE).insert(items.map((i) => ({ ...i, is_done: false })));
  if (error) throw error;
}

// ── Templates ──────────────────────────────────────────────────────────

/**
 * Fallback templates if the `logistics_templates` setting is missing or
 * malformed. Keep in sync with the seed in
 * supabase/migrations/20260417120000_logistics_checklist.sql.
 */
const FALLBACK_TEMPLATES: LogisticsTemplates = {
  "mission.presentiel": [
    { label: "Train réservé", legacy_field: "train_booked" },
    { label: "Hôtel réservé", legacy_field: "hotel_booked" },
  ],
  "mission.remote": [],
  "training.inter.presentiel": [
    { label: "Salle réservée", legacy_field: "room_rental_booked" },
    { label: "Mobilier confirmé (tables, chaises)" },
    { label: "Buffet d'accueil et pauses" },
    { label: "Matériel (paperboard, vidéoprojecteur)", legacy_field: "equipment_ready" },
    { label: "Restaurant midi", legacy_field: "restaurant_booked" },
    { label: "Train réservé (formateur)", legacy_field: "train_booked" },
    { label: "Hôtel réservé (formateur)", legacy_field: "hotel_booked" },
    { label: "Email logistique envoyé au commanditaire" },
  ],
  "training.intra.presentiel": [
    { label: "Confirmation salle commanditaire" },
    { label: "Matériel sur place vérifié", legacy_field: "equipment_ready" },
    { label: "Train réservé (formateur)", legacy_field: "train_booked" },
    { label: "Hôtel réservé (formateur)", legacy_field: "hotel_booked" },
    { label: "Restaurant midi", legacy_field: "restaurant_booked" },
    { label: "Email logistique envoyé au commanditaire" },
  ],
  "training.classe_virtuelle": [
    { label: "Lien visio créé" },
    { label: "Email d'invitation envoyé" },
    { label: "Test technique réalisé" },
  ],
  "training.e_learning": [
    { label: "Plateforme accessible aux participants" },
    { label: "Comptes participants créés" },
    { label: "Email d'accès envoyé" },
  ],
};

let _cachedTemplates: LogisticsTemplates | null = null;
export async function fetchTemplates(): Promise<LogisticsTemplates> {
  if (_cachedTemplates) return _cachedTemplates;
  try {
    const { data } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "logistics_templates")
      .maybeSingle();
    if (data?.setting_value) {
      _cachedTemplates = JSON.parse(data.setting_value) as LogisticsTemplates;
      return _cachedTemplates;
    }
  } catch (err) {
    console.warn("fetchTemplates: falling back to defaults —", err);
  }
  _cachedTemplates = FALLBACK_TEMPLATES;
  return FALLBACK_TEMPLATES;
}

/**
 * Resolve the right template key for an entity.
 * Mission examples: "mission.remote" or "mission.presentiel"
 * Training examples: "training.inter.presentiel", "training.classe_virtuelle"
 */
export function resolveTemplateKey(args: {
  entityType: LogisticsEntityType;
  isRemote?: boolean;
  format?: string | null;
  sessionType?: string | null;
}): string {
  if (args.entityType === "mission") {
    return args.isRemote ? "mission.remote" : "mission.presentiel";
  }
  // Training
  const fmt = args.format || "presentiel";
  if (fmt === "classe_virtuelle") return "training.classe_virtuelle";
  if (fmt === "e_learning") return "training.e_learning";
  // Presentiel — split inter / intra (default to inter when unknown)
  const session = args.sessionType === "intra" ? "intra" : "inter";
  return `training.${session}.${fmt}`;
}

/**
 * Bootstrap the checklist for a brand-new mission/training. Reads the
 * template list from app_settings and inserts one item per template entry.
 * Idempotent-ish: checks whether the entity already has any items first.
 */
export async function bootstrapChecklist(args: {
  entityType: LogisticsEntityType;
  entityId: string;
  isRemote?: boolean;
  format?: string | null;
  sessionType?: string | null;
}): Promise<void> {
  // Avoid double-seeding (e.g. if create-mission flow runs twice)
  const existing = await fetchItems(args.entityType, args.entityId);
  if (existing.length > 0) return;

  const templates = await fetchTemplates();
  const key = resolveTemplateKey(args);
  const items = templates[key] || [];
  if (!items.length) return;

  await createItemsBatch(
    items.map((it: LogisticsTemplateItem, idx) => ({
      entity_type: args.entityType,
      entity_id: args.entityId,
      label: it.label,
      position: idx,
      legacy_field: it.legacy_field ?? null,
      due_date: it.due_date ?? null,
      notify_days_before: it.notify_days_before ?? null,
    })),
  );
}
