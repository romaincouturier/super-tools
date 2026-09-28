/**
 * Outils MCP repris de l'agent intégré (agent-chat) avant son gel : tickets
 * support, cartes de contenu, missions et statut de devis.
 * Chaque écriture ne modifie que les champs transmis et relit la ligne écrite.
 */

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TICKET_STATUSES = ["nouveau", "qualification", "vibe_coding", "resolu"] as const;
export const MISSION_STATUSES = ["not_started", "in_progress", "completed", "cancelled"] as const;
export const QUOTE_STATUSES = ["draft", "generated", "sent", "signed", "expired", "canceled"] as const;

// Une mission porte aussi des montants et des dates de facturation : seuls ces
// champs sont modifiables depuis le connecteur.
export const MISSION_FIELDS = [
  "title",
  "description",
  "client_contact",
  "status",
  "start_date",
  "end_date",
  "tags",
  "waiting_next_action_date",
  "waiting_next_action_text",
] as const;

function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new Error(`${name} doit être un UUID`);
  return value;
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${name} invalide. Valeurs : ${allowed.join(", ")}`);
  return value as T;
}

async function readBack(db: Db, table: string, id: string, columns: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${table} introuvable : ${id}`);
  return data;
}

export async function addSupportNote(
  db: Db,
  args: { ticket_id?: unknown; content?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.ticket_id, "ticket_id");
  const content = typeof args.content === "string" ? args.content.trim() : "";
  if (!content) throw new Error("content est obligatoire");

  const ticket = await readBack(db, "support_tickets", id, "id, resolution_notes");
  const existing = (ticket.resolution_notes as string | null) ?? "";
  const date = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  const notes = `${existing}${existing ? "\n\n---\n\n" : ""}Note (${date}) :\n${content}`;

  const { error } = await db
    .from("support_tickets")
    .update({ resolution_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await log(`add_support_note ${id}`);
  return JSON.stringify({ success: true, ticket: await readBack(db, "support_tickets", id, "id, status, updated_at") });
}

export async function updateTicketStatus(
  db: Db,
  args: { ticket_id?: unknown; status?: unknown; resolution_notes?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.ticket_id, "ticket_id");
  const status = requireOneOf(args.status, TICKET_STATUSES, "status");
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status, updated_at: now };
  if (typeof args.resolution_notes === "string" && args.resolution_notes.trim()) {
    update.resolution_notes = args.resolution_notes;
  }
  if (status === "resolu") update.resolved_at = now;

  const { error } = await db.from("support_tickets").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  await log(`update_ticket_status ${id} -> ${status}`);
  return JSON.stringify({
    success: true,
    ticket: await readBack(db, "support_tickets", id, "id, status, resolution_notes, resolved_at, updated_at"),
  });
}

export async function addContentCard(
  db: Db,
  args: { title?: unknown; description?: unknown; tags?: unknown; column?: unknown },
  log: Log,
  userId: string | null,
): Promise<string> {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  if (!title) throw new Error("title est obligatoire");

  const { data: cols, error: colError } = await db
    .from("content_columns")
    .select("id, name")
    .order("display_order", { ascending: true });
  if (colError) throw new Error(colError.message);
  const columns = (cols ?? []) as Array<{ id: string; name: string }>;
  const wanted = typeof args.column === "string" ? args.column.trim().toLowerCase() : "";
  const column = wanted
    ? columns.find((c) => c.id === args.column || c.name.toLowerCase().includes(wanted))
    : columns.find((c) => c.name === "Idées") ?? columns[0];
  if (!column) {
    throw new Error(`Colonne introuvable. Colonnes : ${columns.map((c) => c.name).join(", ")}`);
  }

  const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string") : [];
  const { data, error } = await db
    .from("content_cards")
    .insert({
      column_id: column.id,
      title,
      description: typeof args.description === "string" ? args.description : "",
      tags,
      created_by: userId,
    })
    .select("id, title, column_id")
    .single();
  if (error) throw new Error(error.message);
  await log(`add_content_card ${data.id}`);
  return JSON.stringify({ success: true, card: { ...data, column: column.name } });
}

export async function updateMission(
  db: Db,
  args: Record<string, unknown>,
  log: Log,
): Promise<string> {
  const id = requireUuid(args.mission_id, "mission_id");
  const updates: Record<string, unknown> = {};
  for (const field of MISSION_FIELDS) {
    if (args[field] !== undefined) updates[field] = args[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new Error(`Aucun champ modifiable fourni. Champs autorisés : ${MISSION_FIELDS.join(", ")}`);
  }
  if (updates.status !== undefined) requireOneOf(updates.status, MISSION_STATUSES, "status");

  const before = await readBack(db, "missions", id, Object.keys(updates).join(", "));
  const { error } = await db
    .from("missions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await log(`update_mission ${id} (${Object.keys(updates).join(", ")})`);
  return JSON.stringify({
    success: true,
    previous: before,
    mission: await readBack(db, "missions", id, [...new Set(["id", "title", ...Object.keys(updates), "updated_at"])].join(", ")),
  });
}

export async function updateQuoteStatus(
  db: Db,
  args: { quote_id?: unknown; status?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.quote_id, "quote_id");
  const status = requireOneOf(args.status, QUOTE_STATUSES, "status");
  const { error } = await db
    .from("quotes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await log(`update_quote_status ${id} -> ${status}`);
  return JSON.stringify({
    success: true,
    quote: await readBack(db, "quotes", id, "id, quote_number, status, total_ht, updated_at"),
  });
}
