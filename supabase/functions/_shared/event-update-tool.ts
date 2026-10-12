/**
 * Outil MCP update_event : patch partiel d'un événement, réponse avant/après.
 */
import type { AuditFn, Supabase } from "./mission-tools.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const COLUMNS =
  "id, title, description, summary_notes, notes, status, cancellation_reason, event_date, event_time, event_end_time, location, location_type, event_type, event_url, private_group_url, updated_at";

const NULLABLE_TEXT = ["description", "summary_notes", "notes", "cancellation_reason", "location", "event_url", "private_group_url"] as const;
const ENUMS: Record<string, string[]> = {
  status: ["active", "cancelled"],
  location_type: ["physical", "visio"],
  event_type: ["internal", "external"],
};

export async function updateEvent(
  supabase: Supabase,
  eventId: string,
  input: Record<string, unknown>,
  audit: AuditFn,
): Promise<string> {
  const id = (eventId || "").trim();
  if (!UUID_RE.test(id)) throw new Error("event_id doit être un UUID");

  const { data: existing } = await (supabase as any).from("events").select(COLUMNS).eq("id", id).maybeSingle();
  if (!existing) throw new Error("Événement introuvable");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = String(input.title ?? "").trim();
    if (!t) throw new Error("title ne peut pas être vide");
    patch.title = t;
  }
  for (const k of NULLABLE_TEXT) {
    if (input[k] === undefined) continue;
    patch[k] = input[k] === null ? null : String(input[k]).trim() || null;
  }
  for (const [k, allowed] of Object.entries(ENUMS)) {
    if (input[k] === undefined) continue;
    if (!allowed.includes(String(input[k]))) throw new Error(`${k} doit valoir : ${allowed.join(", ")}`);
    patch[k] = input[k];
  }
  if (input.event_date !== undefined) {
    if (!DATE_RE.test(String(input.event_date))) throw new Error("event_date doit être au format YYYY-MM-DD");
    patch.event_date = input.event_date;
  }
  for (const k of ["event_time", "event_end_time"] as const) {
    if (input[k] === undefined) continue;
    if (input[k] !== null && !TIME_RE.test(String(input[k]))) throw new Error(`${k} doit être au format HH:MM ou null`);
    patch[k] = input[k];
  }
  const unknown = Object.keys(input).filter((k) => !(k in patch) && input[k] !== undefined);
  if (unknown.length) throw new Error(`Champs non modifiables : ${unknown.join(", ")}`);
  if (Object.keys(patch).length === 0) throw new Error("Aucun champ à modifier");

  const start = (patch.event_time ?? existing.event_time) as string | null;
  const end = (patch.event_end_time ?? existing.event_end_time) as string | null;
  if (start && end && end < start) throw new Error("event_end_time ne peut pas précéder event_time");

  await audit(`update_event ${id}: ${Object.keys(patch).join(", ")}`);
  const { data: updated, error } = await (supabase as any).from("events").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    before: existing,
    event: updated,
    hint: "Seuls les champs fournis ont été modifiés. L'événement ne peut pas être supprimé depuis ici.",
  });
}
