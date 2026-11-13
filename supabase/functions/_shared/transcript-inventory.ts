import { assertCompleteDuration, assembleAudioParts } from "./drive-transcription.ts";
import { isEmptyOrParasiteTranscript } from "./transcript-quality.ts";

export type InventoryState = "complete" | "missing" | "processing" | "blocked" | "error" | "empty" | "summary_only" | "trashed" | "unverified" | "mismatch" | "source_empty";
export interface InventoryItem {
  external_id: string;
  title: string;
  date?: string;
  state?: InventoryState;
  transcript_id?: string;
  detail?: string;
  source_hash?: string;
  source_sentences?: number;
  source_duration?: number;
  checked?: boolean;
}
export interface InventoryTranscript {
  id: string;
  external_id: string;
  status: string;
  raw_text?: string | null;
  updated_at: string;
  duration_seconds?: number | null;
  metadata?: Record<string, any> | null;
}

export function normalizeTranscriptText(text: string): string {
  return text.normalize("NFC").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

export async function transcriptHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeTranscriptText(text));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function firefliesText(t: { sentences?: Array<{ speaker_name?: string; text: string }> | null }): string {
  return (t.sentences ?? []).map((s) => `${s.speaker_name ?? "Intervenant"}: ${s.text}`).join("\n");
}

export async function classifyInventoryItem(source: string, item: InventoryItem, row?: InventoryTranscript): Promise<InventoryItem> {
  const base = { ...item, transcript_id: row?.id };
  if (!row) return { ...base, state: "missing" };
  if (row.status === "trashed") return { ...base, state: "trashed" };
  if (row.status === "processing" || row.status === "pending") return { ...base, state: Date.now() - new Date(row.updated_at).getTime() > 86400000 ? "blocked" : "processing" };
  if (!row.raw_text?.trim()) return { ...base, state: "empty", detail: "Fiche sans texte" };
  if (row.metadata?.text_origin === "summary") return { ...base, state: "summary_only" };
  if (row.status === "error" || isEmptyOrParasiteTranscript(row.raw_text)) return { ...base, state: "error" };
  if (source === "fireflies") {
    if (!item.checked) return { ...base, state: "unverified", detail: "Texte source non contrôlé" };
    if (!item.source_sentences) return { ...base, state: "source_empty", detail: "La source ne fournit aucune phrase" };
    return { ...base, state: await transcriptHash(row.raw_text) === item.source_hash ? "complete" : "mismatch", detail: "Comparaison avec les phrases Fireflies" };
  }
  const expected = Number(item.source_duration ?? 0);
  if (!expected) return { ...base, state: "unverified", detail: "Durée originale indisponible" };
  try {
    assertCompleteDuration(expected, Number(row.duration_seconds));
    const parts = row.metadata?.audio_parts ?? [];
    if (parts.length) {
      if (parts.length !== row.metadata?.audio_total_parts) throw new Error("Nombre de morceaux incomplet");
      const assembled = assembleAudioParts(parts, expected);
      if (await transcriptHash(assembled.text) !== await transcriptHash(row.raw_text)) throw new Error("Texte assemblé différent du texte conservé");
    }
    return { ...base, state: "complete", detail: "Durée vérifiée ; transcription automatique, pas une certification des paroles" };
  } catch (e) {
    return { ...base, state: "mismatch", detail: e instanceof Error ? e.message : String(e) };
  }
}

export function inventorySummary(items: InventoryItem[]): Record<string, number> {
  const counts: Record<string, number> = { total: items.length };
  for (const item of items) counts[item.state ?? "unverified"] = (counts[item.state ?? "unverified"] ?? 0) + 1;
  return counts;
}

export function canRepairInventoryItem(item: InventoryItem, row?: InventoryTranscript): boolean {
  return row?.status !== "trashed" && row?.status !== "processing" && row?.status !== "pending"
    && ["missing", "blocked", "error", "empty", "summary_only", "mismatch"].includes(item.state ?? "");
}