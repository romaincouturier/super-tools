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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

async function syncSchedule(db: Db, trainingId: string, oldStart: string | null, start: string | null, end: string | null) {
  const { data: rows, error } = await db.from("training_schedules")
    .select("day_date, start_time, end_time").eq("training_id", trainingId).order("day_date");
  if (error) throw new Error(error.message);
  if (!rows?.length || !start) return null;
  const shift = oldStart ? dayDiff(start, oldStart) : 0;
  let days = rows.map((r: any) => ({ ...r, day_date: addDays(r.day_date, shift) }));
  const last = end ?? start;
  days = days.filter((d: any) => d.day_date >= start && d.day_date <= last);
  const tpl = days[days.length - 1] ?? rows[rows.length - 1];
  let cur = days.length ? addDays(days[days.length - 1].day_date, 1) : start;
  while (cur <= last) {
    const wd = new Date(`${cur}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push({ day_date: cur, start_time: tpl.start_time, end_time: tpl.end_time });
    cur = addDays(cur, 1);
  }
  const { error: dErr } = await db.from("training_schedules").delete().eq("training_id", trainingId);
  if (dErr) throw new Error(dErr.message);
  if (days.length) {
    const { error: iErr } = await db.from("training_schedules").insert(days.map((d: any) => ({ training_id: trainingId, ...d })));
    if (iErr) throw new Error(iErr.message);
  }
  return days.map((d: any) => `${d.day_date} ${d.start_time}-${d.end_time}`);
}

export async function updateTraining(
  db: Db,
  input: { training_id: string; start_date?: string; end_date?: string; location?: string; meeting_url?: string },
  log: Log,
): Promise<string> {
  if (!UUID_RE.test(input.training_id || "")) throw new Error("training_id invalide");
  const { data: t, error } = await db.from("trainings")
    .select("id, training_name, start_date, end_date, location").eq("id", input.training_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error("Formation introuvable");

  const patch: Record<string, string> = {};
  for (const k of ["start_date", "end_date"] as const) {
    if (input[k] === undefined) continue;
    if (!DATE_RE.test(input[k]!)) throw new Error(`${k} doit être au format YYYY-MM-DD`);
    patch[k] = input[k]!;
  }
  const start = patch.start_date ?? t.start_date;
  const end = patch.end_date ?? t.end_date;
  if (start && end && end < start) throw new Error("end_date est antérieure à start_date");

  const loc = input.location?.trim();
  const url = input.meeting_url?.trim();
  if (url && !/^https:\/\/\S+$/i.test(url)) throw new Error("meeting_url doit commencer par https://");
  if (loc && url) throw new Error("location et meeting_url vont dans le même champ lieu : n'en passer qu'un, ou mettre à jour les lives via meeting_url seul");

  let livesUpdated = 0;
  if (url) {
    const { data: lives, error: lErr } = await db.from("training_live_meetings")
      .update({ meeting_url: url }).eq("training_id", t.id).gte("scheduled_at", new Date().toISOString()).select("id");
    if (lErr) throw new Error(lErr.message);
    livesUpdated = lives?.length ?? 0;
    if (livesUpdated === 0) patch.location = url;
  } else if (loc) {
    patch.location = loc;
  }

  if (Object.keys(patch).length === 0 && livesUpdated === 0) throw new Error("Aucun champ à modifier");
  if (Object.keys(patch).length > 0) {
    const { error: uErr } = await db.from("trainings").update(patch).eq("id", t.id);
    if (uErr) throw new Error(uErr.message);
  }
  const scheduleDays = (patch.start_date || patch.end_date) ? await syncSchedule(db, t.id, t.start_date, start, end) : null;
  await log(`update_training ${t.id} ${Object.keys(patch).join(",")}${livesUpdated ? ` lives:${livesUpdated}` : ""}`);
  return JSON.stringify({
    updated: true, training: t.training_name,
    before: { start_date: t.start_date, end_date: t.end_date, location: t.location },
    changes: patch, upcoming_lives_meeting_url_updated: livesUpdated, schedule_days: scheduleDays,
  });
}
