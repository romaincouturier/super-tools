/**
 * Outils CRM exposés au serveur MCP.
 * Écriture volontairement limitée : passer une opportunité en perdue
 * (mêmes champs que l'interface : sales_status, lost_at, loss_reason,
 * loss_reason_detail, colonne « Perdu »), plus le journal d'activité.
 */

export const LOSS_REASONS = [
  "prix",
  "timing",
  "concurrent",
  "besoin_non_qualifie",
  "pas_de_budget",
  "pas_de_reponse",
  "indisponible",
  "no_go",
  "changement_avis",
  "financement_cpf",
  "autre",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export interface MarkOpportunityLostInput {
  card_id?: string;
  search?: string;
  loss_reason: string;
  detail?: string;
  comment?: string;
}

interface CardRow {
  id: string;
  title: string;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  sales_status: string;
  column_id: string;
}

const CARD_FIELDS = "id, title, company, first_name, last_name, email, sales_status, column_id";

function label(card: CardRow): string {
  const who = card.company || [card.first_name, card.last_name].filter(Boolean).join(" ") || card.email || "";
  return who ? `${card.title} (${who})` : card.title;
}

export async function findCards(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  search: string,
): Promise<CardRow[]> {
  const term = search.trim().replace(/[%,]/g, " ");
  const like = `%${term}%`;
  const { data, error } = await supabase
    .from("crm_cards")
    .select(CARD_FIELDS)
    .or(
      [
        `company.ilike.${like}`,
        `title.ilike.${like}`,
        `email.ilike.${like}`,
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
      ].join(","),
    )
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (data || []) as CardRow[];
  const open = rows.filter((r) => r.sales_status === "OPEN");
  return open.length > 0 ? open : rows;
}

export async function markOpportunityLost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: MarkOpportunityLostInput,
  log: (message: string) => Promise<void>,
  actorEmail: string,
): Promise<string> {
  const reason = (input.loss_reason || "").trim() as LossReason;
  if (!LOSS_REASONS.includes(reason)) {
    throw new Error(`loss_reason invalide. Valeurs acceptées : ${LOSS_REASONS.join(", ")}`);
  }
  if (!input.card_id && !input.search) {
    throw new Error("Fournir card_id ou search (nom de la société, du contact ou de l'opportunité).");
  }

  let card: CardRow;
  if (input.card_id) {
    const { data, error } = await supabase
      .from("crm_cards")
      .select(CARD_FIELDS)
      .eq("id", input.card_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Aucune opportunité avec l'id ${input.card_id}`);
    card = data as CardRow;
  } else {
    const matches = await findCards(supabase, input.search!);
    if (matches.length === 0) {
      return JSON.stringify({ updated: false, reason: "not_found", search: input.search });
    }
    if (matches.length > 1) {
      return JSON.stringify({
        updated: false,
        reason: "ambiguous",
        message: "Plusieurs opportunités correspondent : rappeler l'outil avec card_id.",
        candidates: matches.map((m) => ({ card_id: m.id, label: label(m), sales_status: m.sales_status })),
      });
    }
    card = matches[0];
  }

  if (card.sales_status === "LOST") {
    return JSON.stringify({ updated: false, reason: "already_lost", card_id: card.id, label: label(card) });
  }

  const { data: lostColumn } = await supabase
    .from("crm_columns")
    .select("id, name")
    .ilike("name", "%perdu%")
    .limit(1)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    sales_status: "LOST",
    lost_at: new Date().toISOString(),
    loss_reason: reason,
    loss_reason_detail: input.detail?.trim() || null,
    status_operational: "TODAY",
    waiting_next_action_date: null,
    waiting_next_action_text: null,
  };
  if (lostColumn?.id) updates.column_id = lostColumn.id;

  const { error: updateError } = await supabase.from("crm_cards").update(updates).eq("id", card.id);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("crm_activity_log").insert([{
    card_id: card.id,
    action_type: "sales_status_changed",
    old_value: card.sales_status,
    new_value: "LOST",
    actor_email: actorEmail,
    metadata: { loss_reason: reason, loss_reason_detail: input.detail || null, via: "mcp" },
  }]);

  if (lostColumn?.id && lostColumn.id !== card.column_id) {
    await supabase.from("crm_activity_log").insert([{
      card_id: card.id,
      action_type: "card_moved",
      old_value: card.column_id,
      new_value: lostColumn.id,
      actor_email: actorEmail,
      metadata: { via: "mcp" },
    }]);
  }

  const commentText = (input.comment || input.detail || "").trim();
  if (commentText) {
    await supabase.from("crm_comments").insert([{
      card_id: card.id,
      content: commentText,
      author_email: actorEmail,
    }]);
  }

  await log(`mark_opportunity_lost ${card.id} ${reason}`);

  return JSON.stringify({
    updated: true,
    card_id: card.id,
    label: label(card),
    sales_status: "LOST",
    loss_reason: reason,
    loss_reason_detail: input.detail?.trim() || null,
    colonne: lostColumn?.name || null,
    commentaire_ajoute: Boolean(commentText),
  });
}

// ── Création / mise à jour d'opportunité ─────────────────────

export const SERVICE_TYPES = ["formation", "mission", "jeu"] as const;
export const ACQUISITION_SOURCES = [
  "recommandation", "linkedin", "site_web", "evenement", "appel_froid", "appel_entrant",
  "email_entrant", "partenaire", "nouvelle_mission", "ancien_client", "recherche_google",
  "reseau", "demarchage", "marche_public", "autre",
] as const;

const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "hotmail.fr", "outlook.com",
  "outlook.fr", "live.com", "live.fr", "icloud.com", "me.com", "orange.fr", "wanadoo.fr", "free.fr",
  "sfr.fr", "laposte.net", "gmx.fr", "gmx.com", "protonmail.com", "proton.me", "aol.com", "bbox.fr",
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CARD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// deno-lint-ignore no-explicit-any
async function resolveColumn(supabase: any, column: string): Promise<{ id: string; name: string }> {
  const c = column.trim();
  const q = supabase.from("crm_columns").select("id, name").eq("is_archived", false);
  const { data, error } = CARD_UUID_RE.test(c) ? await q.eq("id", c) : await q.ilike("name", `%${c}%`);
  if (error) throw new Error(error.message);
  if (!data?.length) {
    const { data: all } = await supabase.from("crm_columns").select("name").eq("is_archived", false).order("position");
    throw new Error(`Colonne introuvable : ${c}. Colonnes : ${(all || []).map((x: { name: string }) => x.name).join(", ")}`);
  }
  if (data.length > 1) {
    const exact = data.find((x: { name: string }) => x.name.toLowerCase() === c.toLowerCase());
    if (exact) return exact;
    throw new Error(`Colonne ambiguë : ${data.map((x: { name: string }) => x.name).join(", ")}`);
  }
  return data[0];
}

function nextActionFields(text?: string, date?: string): Record<string, unknown> {
  if (date !== undefined && date !== "" && !DATE_RE.test(date)) throw new Error("next_action_date doit être au format YYYY-MM-DD");
  const out: Record<string, unknown> = {};
  if (text !== undefined) {
    out.next_action_text = text || null;
    out.waiting_next_action_text = text || null;
    out.next_action_done = false;
  }
  if (date !== undefined) {
    out.waiting_next_action_date = date || null;
    out.status_operational = date && date > todayParis() ? "WAITING" : "TODAY";
  }
  return out;
}

export interface CreateOpportunityInput {
  title: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  service_type?: string;
  acquisition_source?: string;
  source_email_url?: string;
  estimated_value?: number;
  column?: string;
  next_action_text?: string;
  next_action_date?: string;
  description?: string;
  force?: boolean;
}

// deno-lint-ignore no-explicit-any
async function findDuplicates(supabase: any, email?: string, company?: string): Promise<CardRow[]> {
  const filters: string[] = [];
  const e = (email || "").trim().toLowerCase();
  if (e.includes("@")) {
    filters.push(`email.ilike.${e.replace(/[%,]/g, "")}`);
    const domain = e.split("@")[1];
    if (domain && !GENERIC_DOMAINS.has(domain)) filters.push(`email.ilike.%@${domain.replace(/[%,]/g, "")}`);
  }
  const c = (company || "").trim().replace(/[%,]/g, " ");
  if (c.length >= 3) filters.push(`company.ilike.%${c}%`);
  if (!filters.length) return [];
  const { data, error } = await supabase
    .from("crm_cards")
    .select(CARD_FIELDS)
    .or(filters.join(","))
    .eq("sales_status", "OPEN")
    .limit(20);
  if (error) throw new Error(error.message);
  return (data || []) as CardRow[];
}

export async function createOpportunity(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: CreateOpportunityInput,
  log: (message: string) => Promise<void>,
  actorEmail: string,
): Promise<string> {
  const title = (input.title || "").trim();
  if (!title) throw new Error("title est requis");
  if (input.service_type && !SERVICE_TYPES.includes(input.service_type as typeof SERVICE_TYPES[number])) {
    throw new Error(`service_type invalide. Valeurs : ${SERVICE_TYPES.join(", ")}`);
  }
  if (input.acquisition_source && !ACQUISITION_SOURCES.includes(input.acquisition_source as typeof ACQUISITION_SOURCES[number])) {
    throw new Error(`acquisition_source invalide. Valeurs : ${ACQUISITION_SOURCES.join(", ")}`);
  }

  if (!input.force) {
    const dups = await findDuplicates(supabase, input.email, input.company);
    if (dups.length) {
      return JSON.stringify({
        created: false,
        reason: "possible_duplicate",
        message: "Opportunités ouvertes proches (même email, domaine ou société). Utiliser update_opportunity, ou rappeler avec force=true pour créer quand même.",
        candidates: dups.map((d) => ({ card_id: d.id, label: label(d), email: d.email })),
      });
    }
  }

  const column = await resolveColumn(supabase, input.column || "Entrant");
  const { data: last } = await supabase
    .from("crm_cards").select("position").eq("column_id", column.id)
    .order("position", { ascending: false }).limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;

  const cap = (s?: string) => (s ? s.trim().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : null);
  const row: Record<string, unknown> = {
    column_id: column.id,
    title,
    description_html: input.description ? `<p>${input.description.replace(/</g, "&lt;")}</p>` : null,
    first_name: cap(input.first_name),
    last_name: cap(input.last_name),
    email: input.email ? input.email.trim().toLowerCase() : null,
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    service_type: input.service_type || null,
    acquisition_source: input.acquisition_source || null,
    estimated_value: input.estimated_value ?? 0,
    sales_status: "OPEN",
    status_operational: "TODAY",
    position,
    source_metadata: { via: "mcp", ...(input.source_email_url ? { email_url: input.source_email_url } : {}) },
    ...nextActionFields(input.next_action_text, input.next_action_date),
  };

  const { data: created, error } = await supabase.from("crm_cards").insert(row).select("id").single();
  if (error) throw new Error(error.message);

  await supabase.from("crm_activity_log").insert([{
    card_id: created.id, action_type: "card_created", new_value: title, actor_email: actorEmail, metadata: { via: "mcp" },
  }]);
  if (input.source_email_url) {
    await supabase.from("crm_comments").insert([{
      card_id: created.id, content: `Mail source : ${input.source_email_url}`, author_email: actorEmail,
    }]);
  }
  await log(`create_opportunity ${created.id} ${title.slice(0, 120)}`);

  return JSON.stringify({ created: true, card_id: created.id, title, colonne: column.name, position });
}

export interface UpdateOpportunityInput {
  card_id?: string;
  search?: string;
  column?: string;
  next_action_text?: string;
  next_action_date?: string;
  estimated_value?: number;
  comment?: string;
}

export async function updateOpportunity(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: UpdateOpportunityInput,
  log: (message: string) => Promise<void>,
  actorEmail: string,
): Promise<string> {
  const card = await resolveCard(supabase, input.card_id, input.search);
  if (typeof card === "string") return card;

  const { data: before } = await supabase
    .from("crm_cards")
    .select("column_id, estimated_value, next_action_text, waiting_next_action_date, status_operational")
    .eq("id", card.id).single();

  const updates: Record<string, unknown> = nextActionFields(input.next_action_text, input.next_action_date);
  let column: { id: string; name: string } | null = null;
  if (input.column) {
    column = await resolveColumn(supabase, input.column);
    if (column.id !== card.column_id) {
      const { data: last } = await supabase
        .from("crm_cards").select("position").eq("column_id", column.id)
        .order("position", { ascending: false }).limit(1);
      updates.column_id = column.id;
      updates.position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
    }
  }
  if (input.estimated_value !== undefined) updates.estimated_value = input.estimated_value;

  if (Object.keys(updates).length) {
    const { error } = await supabase.from("crm_cards").update(updates).eq("id", card.id);
    if (error) throw new Error(error.message);
  }

  const logs: Record<string, unknown>[] = [];
  if (updates.column_id) {
    logs.push({ card_id: card.id, action_type: "card_moved", old_value: card.column_id, new_value: updates.column_id, actor_email: actorEmail, metadata: { via: "mcp" } });
  }
  if (updates.estimated_value !== undefined && Number(updates.estimated_value) !== Number(before?.estimated_value)) {
    logs.push({ card_id: card.id, action_type: "estimated_value_changed", old_value: String(before?.estimated_value ?? ""), new_value: String(updates.estimated_value), actor_email: actorEmail, metadata: { via: "mcp" } });
  }
  if (updates.status_operational && updates.status_operational !== before?.status_operational) {
    logs.push({ card_id: card.id, action_type: "status_operational_changed", old_value: before?.status_operational, new_value: updates.status_operational, actor_email: actorEmail, metadata: { via: "mcp" } });
  }
  const comment = (input.comment || "").trim();
  if (comment) {
    await supabase.from("crm_comments").insert([{ card_id: card.id, content: comment, author_email: actorEmail }]);
    logs.push({ card_id: card.id, action_type: "comment_added", new_value: comment.slice(0, 200), actor_email: actorEmail, metadata: { via: "mcp" } });
  }
  if (logs.length) await supabase.from("crm_activity_log").insert(logs);

  if (!Object.keys(updates).length && !comment) {
    return JSON.stringify({ updated: false, reason: "nothing_to_update", card_id: card.id, label: label(card) });
  }
  await log(`update_opportunity ${card.id} ${Object.keys(updates).join(",")}${comment ? ",comment" : ""}`);

  return JSON.stringify({
    updated: true,
    card_id: card.id,
    label: label(card),
    before,
    changes: updates,
    colonne: column?.name,
    commentaire_ajoute: Boolean(comment),
  });
}

/** Carte par id ou recherche ; renvoie une réponse JSON (string) si introuvable/ambiguë. */
export async function resolveCard(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cardId?: string,
  search?: string,
): Promise<CardRow | string> {
  if (cardId) {
    const { data, error } = await supabase.from("crm_cards").select(CARD_FIELDS).eq("id", cardId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Aucune opportunité avec l'id ${cardId}`);
    return data as CardRow;
  }
  if (!search) throw new Error("Fournir card_id ou search.");
  const matches = await findCards(supabase, search);
  if (!matches.length) return JSON.stringify({ updated: false, reason: "not_found", search });
  if (matches.length > 1) {
    return JSON.stringify({
      updated: false,
      reason: "ambiguous",
      message: "Plusieurs opportunités correspondent : rappeler l'outil avec card_id.",
      candidates: matches.map((m) => ({ card_id: m.id, label: label(m), sales_status: m.sales_status })),
    });
  }
  return matches[0];
}
