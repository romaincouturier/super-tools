/**
 * Retour libre reçu après une formation (email, téléphone, oral) : table training_feedbacks.
 * Avec un mail Gmail, le mail est aussi archivé sur la fiche participant (ou la formation)
 * comme le fait attach_email_to_record, et son corps devient le verbatim.
 */
import { fetchGmailMessage, type GmailMessage } from "./gmail.ts";
import { attachEmailToRecord, MAX_FILE_BYTES } from "./record-tools.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

export const FEEDBACK_SOURCES = ["email", "telephone", "oral", "autre"] as const;
export const FEEDBACK_AUTHOR_ROLES = ["participant", "commanditaire", "autre"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTENT = 20000;

export interface FeedbackInput {
  participant_id?: string;
  training_id?: string;
  content?: string;
  gmail_message_id?: string;
  source?: string;
  received_at?: string;
  consent_publication?: boolean;
  author_role?: string;
  author_name?: string;
  follow_up?: string;
}

function parisDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/** Date du mail (en-tête Date) au format AAAA-MM-JJ, sinon aujourd'hui. */
export function feedbackDate(explicit: string | undefined, mailDate: string | undefined): string {
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const parsed = mailDate ? new Date(mailDate) : null;
  return parsed && !isNaN(parsed.getTime()) ? parisDate(parsed) : parisDate(new Date());
}

export async function logTrainingFeedback(db: Db, input: FeedbackInput, log: Log, actorEmail: string, fetchMail = fetchGmailMessage): Promise<string> {
  const source = input.source ?? (input.gmail_message_id ? "email" : "autre");
  if (!FEEDBACK_SOURCES.includes(source as (typeof FEEDBACK_SOURCES)[number])) throw new Error(`source invalide : ${FEEDBACK_SOURCES.join(", ")}`);
  const role = input.author_role ?? "participant";
  if (!FEEDBACK_AUTHOR_ROLES.includes(role as (typeof FEEDBACK_AUTHOR_ROLES)[number])) throw new Error(`author_role invalide : ${FEEDBACK_AUTHOR_ROLES.join(", ")}`);
  if (!input.participant_id && !input.training_id) throw new Error("participant_id ou training_id est requis");
  if (!input.gmail_message_id && !input.content?.trim()) throw new Error("content ou gmail_message_id est requis");

  let trainingId = input.training_id ?? null;
  let authorName = input.author_name?.trim() || null;
  if (input.participant_id) {
    if (!UUID_RE.test(input.participant_id)) throw new Error("participant_id doit être un UUID");
    const { data: p, error } = await db.from("training_participants")
      .select("id, first_name, last_name, email, training_id").eq("id", input.participant_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error(`participant introuvable : ${input.participant_id}`);
    if (trainingId && trainingId !== p.training_id) throw new Error("training_id ne correspond pas à la session du participant");
    trainingId = p.training_id;
    authorName ??= [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || null;
  } else if (!UUID_RE.test(trainingId!)) {
    throw new Error("training_id doit être un UUID");
  }

  let msg: GmailMessage | null = null;
  let archive: unknown = undefined;
  if (input.gmail_message_id) {
    msg = await fetchMail(input.gmail_message_id, MAX_FILE_BYTES);
    const { data: dup } = await db.from("training_feedbacks").select("id, training_id, participant_id").eq("gmail_message_id", msg.id).maybeSingle();
    if (dup) return JSON.stringify({ created: false, reason: "already_logged", feedback_id: dup.id, training_id: dup.training_id, participant_id: dup.participant_id });
    authorName ??= msg.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || null;
    archive = JSON.parse(await attachEmailToRecord(db, {
      record_type: input.participant_id ? "participant" : "training",
      record_id: input.participant_id ?? trainingId!,
      gmail_message_id: msg.id,
      note: "Retour de formation enregistré (onglet Retours)",
    }, log, actorEmail, msg));
  }

  const content = (input.content?.trim() || msg?.text || msg?.snippet || "").slice(0, MAX_CONTENT);
  if (!content) throw new Error("Le mail ne contient aucun texte : passer content");

  const { data: row, error } = await db.from("training_feedbacks").insert({
    training_id: trainingId,
    participant_id: input.participant_id ?? null,
    author_role: role,
    author_name: authorName,
    source,
    received_at: feedbackDate(input.received_at, msg?.date),
    content,
    consent_publication: input.consent_publication === true,
    gmail_message_id: msg?.id ?? null,
    follow_up: input.follow_up?.trim() || null,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await log(`log_training_feedback ${row.id} training:${trainingId}${input.participant_id ? ` participant:${input.participant_id}` : ""}${msg ? ` gmail:${msg.id}` : ""}`);
  return JSON.stringify({ created: true, feedback_id: row.id, training_id: trainingId, participant_id: input.participant_id ?? null, author_name: authorName, content_chars: content.length, email_archive: archive });
}
