// Outils MCP des perles clients (list_pearls, add_pearl, update_pearl, archive_pearl).
// Logique pure : le client Supabase est injecté, serve() reste dans mcp-server.

export const PEARL_SOURCES = ["mail", "oral", "linkedin", "evaluation", "notion", "autre"] as const;

const LIST_COLUMNS =
  "id, title, message, message_fr, author_name, author_company, is_anonymous, is_positive, pearl_date, pearl_time, source, archived, gmail_thread_id, mission_id, training_id";

const ADD_FIELDS = [
  "message_fr", "title", "author_name", "author_company", "is_anonymous", "is_positive",
  "pearl_date", "pearl_time", "source", "gmail_thread_id", "mission_id", "training_id",
] as const;
const UPDATE_FIELDS = [
  "message", "message_fr", "title", "author_name", "author_company", "is_anonymous", "is_positive",
  "pearl_date", "pearl_time", "source", "archived", "mission_id", "training_id",
] as const;

const BOOLEAN_FIELDS = new Set(["is_anonymous", "is_positive", "archived"]);
const UUID_FIELDS = new Set(["mission_id", "training_id"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

// deno-lint-ignore no-explicit-any
export type PearlDb = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };
export type PearlToolResult = { data: unknown } | { error: string };
type Args = Record<string, unknown>;

/** Contrôle le type d'un champ ; renvoie un message d'erreur ou null. */
export function validatePearlField(field: string, value: unknown): string | null {
  if (value === null) return null;
  if (BOOLEAN_FIELDS.has(field)) return typeof value === "boolean" ? null : `${field} must be a boolean`;
  if (typeof value !== "string") return `${field} must be a string`;
  if (field === "source" && !(PEARL_SOURCES as readonly string[]).includes(value)) {
    return `source must be one of ${PEARL_SOURCES.join(", ")}`;
  }
  if (field === "pearl_date" && !DATE_RE.test(value)) return "pearl_date must be YYYY-MM-DD";
  if (field === "pearl_time" && !TIME_RE.test(value)) return "pearl_time must be HH:MM";
  if (UUID_FIELDS.has(field) && !UUID_RE.test(value)) return `${field} must be a UUID`;
  return null;
}

export async function listPearls(db: PearlDb, args: Args): Promise<PearlToolResult> {
  if (args.random === true) {
    const { data, error } = await db.rpc("get_random_client_pearl", { p_exclude: null });
    return error ? { error: `Error: ${error.message}` } : { data };
  }
  let q = db.from("client_pearls").select(LIST_COLUMNS).order("pearl_date", { ascending: false }).limit(100);
  if (args.include_archived !== true) q = q.eq("archived", false);
  if (args.source) q = q.eq("source", args.source);
  if (typeof args.positive === "boolean") q = q.eq("is_positive", args.positive);
  if (typeof args.mission_id === "string") q = q.eq("mission_id", args.mission_id);
  if (typeof args.training_id === "string") q = q.eq("training_id", args.training_id);
  if (typeof args.search === "string" && args.search.trim()) {
    const t = args.search.trim().replace(/[%,()]/g, " ");
    q = q.or(`message.ilike.%${t}%,message_fr.ilike.%${t}%,title.ilike.%${t}%,author_name.ilike.%${t}%,author_company.ilike.%${t}%`);
  }
  const { data, error } = await q;
  return error ? { error: `Error: ${error.message}` } : { data };
}

export async function addPearl(db: PearlDb, args: Args): Promise<PearlToolResult> {
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!message) return { error: "message is required" };
  const row: Record<string, unknown> = { message };
  for (const f of ADD_FIELDS) {
    if (args[f] === undefined || args[f] === "") continue;
    const invalid = validatePearlField(f, args[f]);
    if (invalid) return { error: invalid };
    row[f] = args[f];
  }
  const { data, error } = await db.from("client_pearls").insert(row).select("*").single();
  if (error) {
    return { error: error.code === "23505" ? "Pearl already stored for this gmail_thread_id" : `Error: ${error.message}` };
  }
  return { data };
}

export async function updatePearl(db: PearlDb, args: Args): Promise<PearlToolResult> {
  const { data: before } = await db.from("client_pearls").select("*").eq("id", args.id).maybeSingle();
  if (!before) return { error: "Pearl not found" };
  const patch: Record<string, unknown> = {};
  for (const f of UPDATE_FIELDS) {
    if (args[f] === undefined) continue;
    const value = args[f] === "" ? null : args[f];
    const invalid = validatePearlField(f, value);
    if (invalid) return { error: invalid };
    patch[f] = value;
  }
  if (patch.message === null) return { error: "message cannot be empty" };
  if (Object.keys(patch).length === 0) return { error: "Nothing to update" };
  const { data: after, error } = await db.from("client_pearls").update(patch).eq("id", args.id).select("*").single();
  return error ? { error: `Error: ${error.message}` } : { data: { before, after } };
}

export async function archivePearl(db: PearlDb, args: Args): Promise<PearlToolResult> {
  const archived = args.archived !== false;
  const { data, error } = await db.from("client_pearls").update({ archived }).eq("id", args.id)
    .select("id, archived").maybeSingle();
  if (error) return { error: `Error: ${error.message}` };
  return data ? { data } : { error: "Pearl not found" };
}
