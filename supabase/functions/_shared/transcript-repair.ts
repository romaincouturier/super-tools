import { firefliesText, transcriptHash } from "./transcript-inventory.ts";
import { getFirefliesMeeting } from "./fireflies-client.ts";
import { isEmptyOrParasiteTranscript, PARASITE_TRANSCRIPT_ERROR } from "./transcript-quality.ts";

export async function importFirefliesText(admin: any, id: string, existing?: any): Promise<{ row: any; before: any }> {
  const meeting = await getFirefliesMeeting(id);
  const text = firefliesText(meeting);
  if (!text.trim() || isEmptyOrParasiteTranscript(text)) throw new Error("Fireflies ne fournit pas de transcript exploitable ; aucune modification effectuée");
  if (existing?.status === "trashed") throw new Error("Une fiche à la corbeille ne peut pas être restaurée par le contrôle");
  const patch = {
    raw_text: text,
    status: "ready",
    error_message: null,
    duration_seconds: Math.round(Number(meeting.duration ?? 0) * 60) || null,
    metadata: { ...(existing?.metadata ?? {}), fireflies_date: new Date(meeting.date).toISOString(), text_origin: "sentences", source_hash: await transcriptHash(text), source_sentence_count: meeting.sentences?.length ?? 0, source_verified_at: new Date().toISOString() },
  };
  const query = existing
    ? admin.from("transcripts").update(patch).eq("id", existing.id).eq("updated_at", existing.updated_at).neq("status", "trashed")
    : admin.from("transcripts").insert({ ...patch, source: "fireflies", external_id: meeting.id, title: meeting.title, summary: meeting.summary?.overview ?? "" });
  const { data: row, error } = await query.select("*").single();
  if (error || !row) throw new Error(error?.message ?? "Écriture refusée ; fiche modifiée simultanément");
  return { row, before: existing ?? null };
}

export function firefliesInitialStatus(text: string, hasSentences: boolean): { status: string; error_message: string | null; text_origin: string } {
  if (!hasSentences) return { status: "error", error_message: text.trim() ? "Fireflies fournit uniquement un résumé, sans transcript intégral" : "Fireflies ne fournit aucun texte", text_origin: "summary" };
  return { status: isEmptyOrParasiteTranscript(text) ? "error" : "ready", error_message: isEmptyOrParasiteTranscript(text) ? PARASITE_TRANSCRIPT_ERROR : null, text_origin: "sentences" };
}