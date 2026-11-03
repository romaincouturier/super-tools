/**
 * Outils MCP repris de l'agent intégré (agent-chat) avant son gel : bilan
 * d'activité, tickets support, cartes de contenu et statut de devis.
 * Chaque écriture ne modifie que les champs transmis, vérifie qu'une ligne a
 * bien été écrite, puis seulement la journalise.
 */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TICKET_STATUSES = ["nouveau", "qualification", "vibe_coding", "resolu", "boite_a_idees"] as const;
export const QUOTE_STATUSES = ["draft", "generated", "sent", "signed", "expired", "canceled"] as const;

function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new Error(`${name} doit être un UUID`);
  return value;
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${name} invalide. Valeurs : ${allowed.join(", ")}`);
  return value as T;
}

async function readRow(db: Db, table: string, id: string, columns: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${table} introuvable : ${id}`);
  return data;
}

/** Met à jour une ligne par id et renvoie la ligne écrite ; lève si aucune ligne ne correspond. */
async function updateRow(
  db: Db,
  table: string,
  id: string,
  payload: Record<string, unknown>,
  columns: string,
  expectedUpdatedAt?: string | null,
): Promise<Record<string, unknown> | null> {
  let query = db.from(table).update(payload).eq("id", id);
  if (expectedUpdatedAt !== undefined) {
    query = expectedUpdatedAt === null ? query.is("updated_at", null) : query.eq("updated_at", expectedUpdatedAt);
  }
  const { data, error } = await query.select(columns).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function appendNote(existing: string | null | undefined, content: string): string {
  const date = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  const prev = existing ?? "";
  return `${prev}${prev ? "\n\n---\n\n" : ""}Note (${date}) :\n${content}`;
}

/** Bilan d'activité des 30 derniers jours, calculé par business-health-score. */
export async function getBusinessHealth(log: Log): Promise<string> {
  await log("get_business_health");
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/business-health-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`business-health-score : ${res.status} ${body.slice(0, 300)}`);
  return body;
}

const TICKET_COLUMNS =
  "id, ticket_number, title, description, status, resolution_notes, resolved_at, submitted_by_email, updated_at";

/**
 * Ajoute une note datée sans écraser une écriture concurrente : l'update est
 * conditionné à l'updated_at lu, et rejoué une fois si le ticket a bougé.
 */
async function writeTicketWithNote(
  db: Db,
  id: string,
  content: string | null,
  extra: (ticket: Record<string, unknown>, now: string) => Record<string, unknown>,
): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await readRow(db, "support_tickets", id, TICKET_COLUMNS);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { ...extra(before, now), updated_at: now };
    if (content) payload.resolution_notes = appendNote(before.resolution_notes as string | null, content);
    const after = await updateRow(
      db,
      "support_tickets",
      id,
      payload,
      TICKET_COLUMNS,
      (before.updated_at as string | null) ?? null,
    );
    if (after) return { before, after };
  }
  throw new Error("Ticket modifié en même temps par quelqu'un d'autre : relire le ticket et réessayer.");
}

export async function addSupportNote(
  db: Db,
  args: { ticket_id?: unknown; content?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.ticket_id, "ticket_id");
  const content = typeof args.content === "string" ? args.content.trim() : "";
  if (!content) throw new Error("content est obligatoire");

  const { after } = await writeTicketWithNote(db, id, content, () => ({}));
  await log(`add_support_note ${id}`);
  return JSON.stringify({ success: true, ticket: { id: after.id, status: after.status, updated_at: after.updated_at } });
}

/** Même email que l'écran Support quand un ticket passe en résolu (best-effort). */
async function notifyTicketResolved(ticket: Record<string, unknown>): Promise<boolean> {
  if (!ticket.submitted_by_email) return false;
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-support-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        recipientEmail: ticket.submitted_by_email,
        ticketNumber: ticket.ticket_number,
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        moduleLabel: null,
        description: ticket.description ?? null,
        status: ticket.status,
        resolutionNotes: ticket.resolution_notes ?? null,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) console.error(`[update_ticket_status] notification ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("[update_ticket_status] notification échouée", err);
    return false;
  }
}

export async function updateTicketStatus(
  db: Db,
  args: { ticket_id?: unknown; status?: unknown; resolution_notes?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.ticket_id, "ticket_id");
  const status = requireOneOf(args.status, TICKET_STATUSES, "status");
  const note = typeof args.resolution_notes === "string" ? args.resolution_notes.trim() : "";

  const { before, after } = await writeTicketWithNote(db, id, note || null, (ticket, now) => {
    const update: Record<string, unknown> = { status };
    if (status === "resolu" && ticket.status !== "resolu") update.resolved_at = now;
    if (status !== "resolu" && ticket.status === "resolu") update.resolved_at = null;
    return update;
  });
  await log(`update_ticket_status ${id} -> ${status}`);

  const submitterNotified = status === "resolu" && before.status !== "resolu" ? await notifyTicketResolved(after) : false;
  return JSON.stringify({
    success: true,
    submitter_notified: submitterNotified,
    ticket: {
      id: after.id,
      status: after.status,
      resolution_notes: after.resolution_notes,
      resolved_at: after.resolved_at,
      updated_at: after.updated_at,
    },
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
  const names = columns.map((c) => c.name).join(", ");
  const wanted = typeof args.column === "string" ? args.column.trim().toLowerCase() : "";

  let column: { id: string; name: string } | undefined;
  if (wanted) {
    const exact = columns.filter((c) => c.id === args.column || c.name.toLowerCase() === wanted);
    const partial = exact.length ? exact : columns.filter((c) => c.name.toLowerCase().includes(wanted));
    if (partial.length > 1) throw new Error(`Colonne ambiguë : ${partial.map((c) => c.name).join(", ")}`);
    column = partial[0];
  } else {
    column = columns.find((c) => c.name === "Idées") ?? columns[0];
  }
  if (!column) throw new Error(`Colonne introuvable. Colonnes : ${names}`);

  const { data: last, error: orderError } = await db
    .from("content_cards")
    .select("display_order")
    .eq("column_id", column.id)
    .order("display_order", { ascending: false })
    .limit(1);
  if (orderError) throw new Error(orderError.message);
  const displayOrder = ((last?.[0]?.display_order as number | undefined) ?? -1) + 1;

  const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string") : [];
  const { data, error } = await db
    .from("content_cards")
    .insert({
      column_id: column.id,
      title,
      description: typeof args.description === "string" ? args.description : "",
      tags,
      display_order: displayOrder,
      created_by: userId,
    })
    .select("id, title, column_id")
    .single();
  if (error) throw new Error(error.message);
  await log(`add_content_card ${data.id}`);
  return JSON.stringify({ success: true, card: { ...data, column: column.name } });
}

export async function updateQuoteStatus(
  db: Db,
  args: { quote_id?: unknown; status?: unknown },
  log: Log,
): Promise<string> {
  const id = requireUuid(args.quote_id, "quote_id");
  const status = requireOneOf(args.status, QUOTE_STATUSES, "status");
  const current = await readRow(db, "quotes", id, "id, status");
  if (current.status === "signed" && status !== "signed") {
    throw new Error("Un devis signé ne change plus de statut.");
  }
  const quote = await updateRow(
    db,
    "quotes",
    id,
    { status, updated_at: new Date().toISOString() },
    "id, quote_number, status, total_ht, updated_at",
  );
  if (!quote) throw new Error(`quotes introuvable : ${id}`);
  await log(`update_quote_status ${id} -> ${status}`);
  return JSON.stringify({ success: true, quote });
}
