/**
 * Outils MCP rattachés à un dossier (mission, formation, opportunité) :
 * mail Gmail + pièces jointes, logistique (train/hôtel...), trace d'interaction.
 * Toutes les écritures sont additives, sauf la case logistique (booléen).
 */
import { fetchGmailMessage } from "./gmail.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

export const RECORD_TYPES = ["mission", "training", "opportunity"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function sanitize(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "fichier";
}

async function recordLabel(db: Db, type: RecordType, id: string): Promise<string> {
  if (!UUID_RE.test(id)) throw new Error("record_id doit être un UUID");
  const table = type === "mission" ? "missions" : type === "training" ? "trainings" : "crm_cards";
  const field = type === "training" ? "training_name" : "title";
  const { data, error } = await db.from(table).select(`id, ${field}`).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${type} introuvable : ${id}`);
  return String(data[field] || id);
}

async function storeFile(
  db: Db,
  type: RecordType,
  id: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
  actorEmail: string,
): Promise<{ file_name: string; size: number }> {
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`Fichier trop lourd : ${fileName}`);
  const path = `${id}/${type === "opportunity" ? "" : "docs/"}${Date.now()}_${sanitize(fileName)}`;
  const bucket = type === "mission" ? "mission-documents" : type === "training" ? "training-documents" : "crm-attachments";
  const { error: upErr } = await db.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Upload ${fileName} : ${upErr.message}`);

  let insert;
  if (type === "opportunity") {
    insert = await db.from("crm_attachments").insert({ card_id: id, file_name: fileName, file_path: path, file_size: bytes.length, mime_type: mime });
    await db.from("crm_activity_log").insert([{ card_id: id, action_type: "attachment_added", new_value: fileName, actor_email: actorEmail, metadata: { via: "mcp" } }]);
  } else {
    const url = db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    insert = type === "mission"
      ? await db.from("mission_documents").insert({ mission_id: id, file_name: fileName, file_url: url, file_size: bytes.length, mime_type: mime })
      : await db.from("training_documents").insert({ training_id: id, file_name: fileName, file_url: url, file_size: bytes.length });
  }
  if (insert.error) {
    await db.storage.from(bucket).remove([path]);
    throw new Error(`Enregistrement ${fileName} : ${insert.error.message}`);
  }
  return { file_name: fileName, size: bytes.length };
}

export async function attachEmailToRecord(
  db: Db,
  input: { record_type: string; record_id: string; gmail_message_id: string; include_email?: boolean; note?: string },
  log: Log,
  actorEmail: string,
): Promise<string> {
  const type = input.record_type as RecordType;
  if (!RECORD_TYPES.includes(type)) throw new Error(`record_type invalide : ${RECORD_TYPES.join(", ")}`);
  if (!input.gmail_message_id?.trim()) throw new Error("gmail_message_id est requis");
  const recLabel = await recordLabel(db, type, input.record_id);

  const msg = await fetchGmailMessage(input.gmail_message_id, MAX_FILE_BYTES);
  const saved: Array<{ file_name: string; size: number }> = [];
  if (input.include_email !== false) {
    const emlName = `${todayParis()}_${(msg.subject || "mail").slice(0, 80)}.eml`;
    saved.push(await storeFile(db, type, input.record_id, emlName, "message/rfc822", msg.raw, actorEmail));
  }
  for (const a of msg.attachments) {
    saved.push(await storeFile(db, type, input.record_id, a.fileName, a.mimeType, a.bytes, actorEmail));
  }

  await logClientInteraction(db, {
    record_type: type,
    record_id: input.record_id,
    summary: `Mail rattaché : « ${msg.subject} » de ${msg.from} (${msg.date})`,
    action_taken: input.note || `${saved.length} fichier(s) archivé(s) : ${saved.map((s) => s.file_name).join(", ")}`,
  }, async () => {}, actorEmail);

  await log(`attach_email_to_record ${type} ${input.record_id} gmail:${msg.id} (${saved.length} fichiers)`);
  return JSON.stringify({
    attached: true,
    record: recLabel,
    email: { subject: msg.subject, from: msg.from, date: msg.date, gmail_id: msg.id },
    files: saved,
  });
}

export const LOGISTICS_FIELDS = {
  mission: ["train_booked", "hotel_booked"],
  training: ["train_booked", "hotel_booked", "restaurant_booked", "room_rental_booked", "equipment_ready"],
  event: ["train_booked", "hotel_booked", "restaurant_booked", "room_rental_booked"],
} as const;

export async function setLogisticsItem(
  db: Db,
  input: { entity_type: string; entity_id: string; item: string; done?: boolean },
  log: Log,
): Promise<string> {
  const et = input.entity_type as keyof typeof LOGISTICS_FIELDS;
  if (!LOGISTICS_FIELDS[et]) throw new Error("entity_type invalide : mission, training, event");
  if (!UUID_RE.test(input.entity_id || "")) throw new Error("entity_id doit être un UUID");
  const item = (input.item || "").trim();
  if (!item) throw new Error("item est requis (ex. train_booked, hotel_booked, ou libellé de la checklist)");
  const done = input.done !== false;
  const isLegacy = (LOGISTICS_FIELDS[et] as readonly string[]).includes(item);

  const q = db.from("logistics_checklist_items").select("id, label, is_done, legacy_field")
    .eq("entity_type", et).eq("entity_id", input.entity_id);
  const { data: items, error } = isLegacy ? await q.eq("legacy_field", item) : await q.ilike("label", `%${item}%`);
  if (error) throw new Error(error.message);

  if (items?.length > 1) {
    return JSON.stringify({ updated: false, reason: "ambiguous", candidates: items.map((i: { label: string }) => i.label) });
  }
  if (items?.length === 1) {
    const it = items[0];
    const { error: upErr } = await db.from("logistics_checklist_items")
      .update({ is_done: done, done_at: done ? new Date().toISOString() : null }).eq("id", it.id);
    if (upErr) throw new Error(upErr.message);
    await log(`set_logistics_item ${et} ${input.entity_id} ${it.label}=${done}`);
    return JSON.stringify({ updated: true, item: it.label, was_done: it.is_done, is_done: done });
  }
  if (!isLegacy) {
    const { data: all } = await db.from("logistics_checklist_items").select("label")
      .eq("entity_type", et).eq("entity_id", input.entity_id).order("position");
    return JSON.stringify({ updated: false, reason: "not_found", available: (all || []).map((i: { label: string }) => i.label), fields: LOGISTICS_FIELDS[et] });
  }
  const table = et === "mission" ? "missions" : et === "training" ? "trainings" : "events";
  const { data: row, error: upErr } = await db.from(table).update({ [item]: done }).eq("id", input.entity_id).select("id").maybeSingle();
  if (upErr) throw new Error(upErr.message);
  if (!row) throw new Error(`${et} introuvable : ${input.entity_id}`);
  await log(`set_logistics_item ${et} ${input.entity_id} ${item}=${done}`);
  return JSON.stringify({ updated: true, item, is_done: done });
}

export async function logClientInteraction(
  db: Db,
  input: { record_type: string; record_id: string; summary: string; action_taken?: string; date?: string },
  log: Log,
  actorEmail: string,
): Promise<string> {
  const type = input.record_type as RecordType;
  if (!RECORD_TYPES.includes(type)) throw new Error(`record_type invalide : ${RECORD_TYPES.join(", ")}`);
  const summary = (input.summary || "").trim();
  if (!summary) throw new Error("summary est requis");
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayParis();
  const action = (input.action_taken || "").trim();
  const recLabel = await recordLabel(db, type, input.record_id);

  let res;
  if (type === "opportunity") {
    const content = `[${date}] ${summary}${action ? `\nAction menée : ${action}` : ""}`;
    res = await db.from("crm_comments").insert({ card_id: input.record_id, content, author_email: actorEmail });
    if (!res.error) {
      await db.from("crm_activity_log").insert([{ card_id: input.record_id, action_type: "comment_added", new_value: summary.slice(0, 200), actor_email: actorEmail, metadata: { via: "mcp", kind: "client_interaction" } }]);
    }
  } else if (type === "mission") {
    res = await db.from("mission_activities").insert({
      mission_id: input.record_id, description: summary.slice(0, 500), activity_date: date,
      duration: 0, duration_type: "hours", is_billed: false, notes: action || null,
    });
  } else {
    res = await db.from("training_actions").insert({
      training_id: input.record_id, description: `${summary}${action ? ` — Action menée : ${action}` : ""}`.slice(0, 1000),
      due_date: date, status: "completed", completed_at: new Date().toISOString(), assigned_user_email: actorEmail,
    });
  }
  if (res.error) throw new Error(res.error.message);
  await log(`log_client_interaction ${type} ${input.record_id}`);
  return JSON.stringify({ logged: true, record: recLabel, date, summary, action_taken: action || null });
}
