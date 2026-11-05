/**
 * Outils Réseau du connecteur MCP : création de contact, journal
 * d'interaction et rattachement d'un transcript à un contact
 * (network_contact_transcripts + interaction « meeting » + dernier contact).
 *
 * Le connecteur tourne en service role : chaque écriture est faite au nom de
 * l'utilisateur autorisé (ownerId) et ne touche que ses propres contacts,
 * comme la RLS « user_id = auth.uid() » de l'interface.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Supabase = SupabaseClient;

export const WARMTH_LEVELS = ["hot", "warm", "cold"] as const;
export const INTERACTION_TYPES = [
  "meeting", "manual_log", "linkedin_message", "email", "phone_call", "coffee_invite", "share_content", "other",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireOwner(ownerId: string | null): string {
  if (!ownerId) throw new Error("Utilisateur autorisé introuvable");
  return ownerId;
}

function optText(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  const s = v.trim();
  if (s.length > max) throw new Error(`${field} is too long (max ${max})`);
  return s || null;
}

/** Jour Europe/Paris de la réunion : date Fireflies, date fichier Drive, sinon création. */
export function meetingDate(metadata: unknown, createdAt: string): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const raw = [m.fireflies_date, m.file_date].find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) as string | undefined;
  const d = new Date(raw ?? createdAt);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

export function meetingNotes(title: string, summary: string | null | undefined, url: string): string {
  return `Réunion : ${title}\n\n${summary?.trim() || "(pas de résumé)"}\n\nTranscript : ${url}`;
}

async function loadOwnContact(supabase: Supabase, ownerId: string, contactId: unknown) {
  if (typeof contactId !== "string" || !UUID.test(contactId)) throw new Error("contact_id must be a UUID");
  const { data, error } = await supabase
    .from("network_contacts")
    .select("id, name, warmth, last_contact_date")
    .eq("id", contactId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Network contact not found");
  return data as { id: string; name: string; warmth: string; last_contact_date: string | null };
}

export async function createNetworkContact(supabase: Supabase, ownerIdRaw: string | null, args: Record<string, unknown>) {
  const ownerId = requireOwner(ownerIdRaw);
  const name = optText(args.name, "name", 200);
  if (!name) throw new Error("name is required");
  const warmth = (args.warmth ?? "warm") as string;
  if (!WARMTH_LEVELS.includes(warmth as typeof WARMTH_LEVELS[number])) throw new Error("warmth must be hot, warm or cold");
  const linkedin = optText(args.linkedin_url, "linkedin_url", 500);
  if (linkedin && !/^https?:\/\//i.test(linkedin)) throw new Error("linkedin_url must be an http(s) URL");
  const { data, error } = await supabase
    .from("network_contacts")
    .insert({
      user_id: ownerId,
      name,
      context: optText(args.context, "context", 1000),
      warmth,
      linkedin_url: linkedin,
      notes: optText(args.notes, "notes", 5000),
    })
    .select("id, name, context, warmth, linkedin_url, notes, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { status: "created", contact: data };
}

export async function logNetworkInteraction(supabase: Supabase, ownerIdRaw: string | null, args: Record<string, unknown>) {
  const ownerId = requireOwner(ownerIdRaw);
  const contact = await loadOwnContact(supabase, ownerId, args.contact_id);
  const type = args.type as string;
  if (!INTERACTION_TYPES.includes(type as typeof INTERACTION_TYPES[number])) {
    throw new Error(`type must be one of: ${INTERACTION_TYPES.join(", ")}`);
  }
  const notes = optText(args.notes, "notes", 10000);
  const { data, error } = await supabase
    .from("network_interactions")
    .insert({ user_id: ownerId, contact_id: contact.id, interaction_type: type, notes })
    .select("id, interaction_type, notes, created_at")
    .single();
  if (error) throw new Error(error.message);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (!contact.last_contact_date || contact.last_contact_date < today) {
    const { error: uErr } = await supabase.from("network_contacts").update({ last_contact_date: today }).eq("id", contact.id);
    if (uErr) throw new Error(uErr.message);
  }
  return { status: "logged", contact: { id: contact.id, name: contact.name }, interaction: data };
}

export async function linkTranscriptToNetworkContact(
  supabase: Supabase,
  ownerIdRaw: string | null,
  t: { id: string; title: string; summary: string | null; metadata: unknown; created_at: string },
  contactId: string,
  transcriptUrl: string,
) {
  const ownerId = requireOwner(ownerIdRaw);
  const contact = await loadOwnContact(supabase, ownerId, contactId);
  const date = meetingDate(t.metadata, t.created_at);
  const { data: interaction, error: iErr } = await supabase
    .from("network_interactions")
    .insert({
      user_id: ownerId,
      contact_id: contact.id,
      interaction_type: "meeting",
      notes: meetingNotes(t.title, t.summary, transcriptUrl),
      created_at: `${date}T12:00:00+01:00`,
    })
    .select("id")
    .single();
  if (iErr) throw new Error(iErr.message);
  const { error: lErr } = await supabase
    .from("network_contact_transcripts")
    .insert({ contact_id: contact.id, transcript_id: t.id, user_id: ownerId, interaction_id: interaction.id });
  if (lErr) {
    await supabase.from("network_interactions").delete().eq("id", interaction.id);
    throw new Error(lErr.message);
  }
  if (!contact.last_contact_date || contact.last_contact_date < date) {
    const { error } = await supabase.from("network_contacts").update({ last_contact_date: date }).eq("id", contact.id);
    if (error) throw new Error(error.message);
  }
  return { contact: { id: contact.id, name: contact.name }, interaction_id: interaction.id, meeting_date: date };
}
