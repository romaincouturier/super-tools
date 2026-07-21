import { supabase } from "@/integrations/supabase/client";
import type { LogisticsChecklistItem, LogisticsEntityType, LogisticsTemplateItem, LogisticsTemplates, ChecklistTemplate, ChecklistTemplateItem } from "@/types/logistics";
import { resolveTemplateKey } from "@/lib/logisticsTemplateKey";

export { resolveTemplateKey };

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

// ── Unified template CRUD ──────────────────────────────────────────────────

const TEMPLATES_TABLE = "checklist_templates";
const TEMPLATE_ITEMS_TABLE = "checklist_template_items";

export async function fetchChecklistTemplates(entityType?: LogisticsEntityType): Promise<ChecklistTemplate[]> {
  let q = sb.from(TEMPLATES_TABLE).select(`*, items:${TEMPLATE_ITEMS_TABLE}(*)`)
    .order("name", { ascending: true });
  if (entityType) {
    q = q.or(`entity_type.eq.${entityType},entity_type.is.null`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ChecklistTemplate[];
}

export async function createChecklistTemplate(input: {
  name: string;
  entity_type: LogisticsEntityType | null;
  is_global: boolean;
  user_id?: string | null;
}): Promise<ChecklistTemplate> {
  const { data, error } = await sb.from(TEMPLATES_TABLE).insert(input).select().single();
  if (error) throw error;
  return data as ChecklistTemplate;
}

export async function updateChecklistTemplate(id: string, updates: Partial<Pick<ChecklistTemplate, "name" | "entity_type">>): Promise<ChecklistTemplate> {
  const { data, error } = await sb.from(TEMPLATES_TABLE).update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ChecklistTemplate;
}

export async function deleteChecklistTemplate(id: string): Promise<void> {
  const { error } = await sb.from(TEMPLATES_TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function createChecklistTemplateItem(input: Omit<ChecklistTemplateItem, "id" | "created_at">): Promise<ChecklistTemplateItem> {
  const { data, error } = await sb.from(TEMPLATE_ITEMS_TABLE).insert(input).select().single();
  if (error) throw error;
  return data as ChecklistTemplateItem;
}

export async function updateChecklistTemplateItem(id: string, updates: Partial<Pick<ChecklistTemplateItem, "label" | "day_offset" | "notify_days_before" | "position">>): Promise<ChecklistTemplateItem> {
  const { data, error } = await sb.from(TEMPLATE_ITEMS_TABLE).update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ChecklistTemplateItem;
}

export async function deleteChecklistTemplateItem(id: string): Promise<void> {
  const { error } = await sb.from(TEMPLATE_ITEMS_TABLE).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Import all items from a template into an entity's checklist.
 * Dates are calculated from start_date + day_offset.
 * Non-destructive: existing items are not touched.
 */
export async function importTemplate(args: {
  templateId: string;
  entityType: LogisticsEntityType;
  entityId: string;
  startDate: string | null;
}): Promise<void> {
  const { data: tmplItems, error } = await sb
    .from(TEMPLATE_ITEMS_TABLE)
    .select("*")
    .eq("template_id", args.templateId)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!tmplItems?.length) return;

  const existingItems = await fetchItems(args.entityType, args.entityId);
  const nextPosition = existingItems.length;

  const toInsert = (tmplItems as ChecklistTemplateItem[]).map((item, idx) => {
    let due_date: string | null = null;
    if (args.startDate) {
      // Convention: day_offset positif = N jours AVANT la date de début
      // (cohérent avec le champ "Rappel (j avant)" affiché juste à côté).
      const [y, m, d] = args.startDate.slice(0, 10).split("-").map(Number);
      const base = new Date(Date.UTC(y, m - 1, d));
      base.setUTCDate(base.getUTCDate() - (item.day_offset || 0));
      due_date = base.toISOString().slice(0, 10);
    }
    return {
      entity_type: args.entityType,
      entity_id: args.entityId,
      label: item.label,
      position: nextPosition + idx,
      legacy_field: item.legacy_field ?? null,
      due_date,
      notify_days_before: item.notify_days_before ?? null,
      is_done: false,
    };
  });

  await createItemsBatch(toInsert);
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
  startDate?: string | null;
  defaultNotifyDaysBefore?: number;
}): Promise<void> {
  // Avoid double-seeding (e.g. if create-mission flow runs twice)
  const existing = await fetchItems(args.entityType, args.entityId);
  if (existing.length > 0) return;

  const templates = await fetchTemplates();
  const key = resolveTemplateKey(args);
  const items = templates[key] || [];
  if (!items.length) return;

  // Default so every seeded item surfaces in the daily digest.
  // Template-provided due_date/notify_days_before take precedence.
  const defaultNotify = args.defaultNotifyDaysBefore ?? 14;
  const fallbackDue = args.startDate
    ? args.startDate.slice(0, 10)
    : (() => {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString().slice(0, 10);
      })();

  await createItemsBatch(
    items.map((it: LogisticsTemplateItem, idx) => ({
      entity_type: args.entityType,
      entity_id: args.entityId,
      label: it.label,
      position: idx,
      legacy_field: it.legacy_field ?? null,
      due_date: it.due_date ?? fallbackDue,
      notify_days_before: it.notify_days_before ?? defaultNotify,
    })),
  );
}
