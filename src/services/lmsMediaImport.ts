import { supabase } from "@/integrations/supabase/client";

export interface AudioTranscript {
  id: string;
  file_name: string;
  text: string;
}

export interface LessonInfo {
  id: string;
  title: string;
  module_title: string;
}

export interface AudioSegment {
  title: string;
  lesson_id: string | null;
  reformulated_text: string;
  key_points: string[];
}

export interface AudioAssignment {
  audio_id: string;
  segments: AudioSegment[];
}

/**
 * Normalise la réponse IA : accepte le nouveau format multi-segments comme
 * l'ancien format (une seule leçon par audio), et écarte les segments vides.
 */
export function normalizeAudioAssignments(raw: unknown): AudioAssignment[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: AudioAssignment[] = [];
  for (const item of list) {
    const a = item as Record<string, unknown>;
    const audioId = typeof a?.audio_id === "string" ? a.audio_id : "";
    if (!audioId) continue;

    const rawSegments = Array.isArray(a.segments)
      ? (a.segments as unknown[])
      : [{ title: "", lesson_id: a.lesson_id, reformulated_text: a.reformulated_text, key_points: a.key_points }];

    const segments: AudioSegment[] = [];
    for (const s of rawSegments) {
      const seg = s as Record<string, unknown>;
      const text = typeof seg?.reformulated_text === "string" ? seg.reformulated_text.trim() : "";
      if (!text) continue;
      segments.push({
        title: typeof seg.title === "string" ? seg.title : "",
        lesson_id: typeof seg.lesson_id === "string" && seg.lesson_id ? seg.lesson_id : null,
        reformulated_text: text,
        key_points: Array.isArray(seg.key_points)
          ? (seg.key_points as unknown[]).filter((k): k is string => typeof k === "string" && !!k.trim())
          : [],
      });
    }

    if (segments.length) out.push({ audio_id: audioId, segments });
  }
  return out;
}

/**
 * Extract a useful error message from a supabase.functions.invoke() error.
 * The default `error.message` is often just "Edge Function returned a non-2xx
 * status code" — the real message lives in `error.context` (a Response object).
 */
async function extractFunctionError(error: unknown, fnName: string): Promise<Error> {
  const err = error as { message?: string; context?: Response; name?: string };
  let detail = "";
  let status: number | undefined;
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.clone === "function") {
      status = ctx.status;
      const cloned = ctx.clone();
      const text = await cloned.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          detail = parsed?.error || parsed?.message || parsed?.details || text;
        } catch {
          detail = text;
        }
      }
    }
  } catch {
    // ignore
  }
  const base = err?.message || "Erreur inconnue";
  const parts = [`[${fnName}]`];
  if (status) parts.push(`HTTP ${status}`);
  parts.push(detail || base);
  return new Error(parts.join(" · "));
}

/**
 * Transcribe an audio file via AssemblyAI using the submit + poll pattern
 * to avoid edge function wall-time limits.
 */
export interface TranscriptionResult {
  text: string;
  seconds: number | null;
}

export async function transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
  // Step 1: submit the job
  const submitRes = await supabase.functions.invoke("transcribe-audio-long", {
    body: { mode: "submit", audio_url: audioUrl },
  });
  if (submitRes.error) throw await extractFunctionError(submitRes.error, "transcribe-audio-long:submit");
  const transcriptId = (submitRes.data as { transcript_id?: string })?.transcript_id;
  if (!transcriptId) throw new Error("Aucun transcript_id reçu de transcribe-audio-long");

  // Step 2: poll until completion (client-side, no wall-time issue)
  const MAX_POLLS = 720; // 720 * 5s = 60 min (enregistrements d'1h+)
  const POLL_INTERVAL = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const pollRes = await supabase.functions.invoke("transcribe-audio-long", {
      body: { mode: "poll", transcript_id: transcriptId },
    });
    if (pollRes.error) throw await extractFunctionError(pollRes.error, "transcribe-audio-long:poll");
    const data = pollRes.data as { status: string; transcript?: string; error?: string; audio_duration?: number };
    if (data.status === "completed") return { text: data.transcript ?? "", seconds: normalizeAudioSeconds(data.audio_duration) };
    if (data.status === "error") throw new Error(`Transcription échouée : ${data.error || "raison inconnue"}`);
    // queued / processing -> keep polling
  }

  throw new Error("Transcription timeout après 60 minutes");
}

export async function analyzeAudioForLessons(
  transcripts: AudioTranscript[],
  lessons: LessonInfo[],
): Promise<AudioAssignment[]> {
  const { data, error } = await supabase.functions.invoke("lms-analyze-audio", {
    body: { transcripts, lessons },
  });
  if (error) throw await extractFunctionError(error, "lms-analyze-audio");
  const raw = (data as { assignments?: unknown })?.assignments;
  if (!raw) {
    throw new Error("Réponse IA invalide : champ 'assignments' manquant");
  }
  return normalizeAudioAssignments(raw);
}

// ── Conservation et statut des transcriptions sur `media` ──────────────────

export type MediaTranscriptionStatus = "pending" | "transcribed" | "processed" | "error";

export function normalizeAudioSeconds(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Statut affiché d'un audio de cours, déduit de la ligne media et des blocs liés. */
export function resolveAudioStatus(row: {
  transcript: string | null;
  transcription_status: string | null;
  blocks_count: number;
}): MediaTranscriptionStatus {
  if (row.blocks_count > 0 || row.transcription_status === "processed") return "processed";
  if (row.transcription_status === "error") return "error";
  if (row.transcript && row.transcript.trim()) return "transcribed";
  return "pending";
}

export async function setMediaTranscription(
  mediaIds: string[],
  patch: {
    status: MediaTranscriptionStatus;
    transcript?: string;
    seconds?: number | null;
    error?: string | null;
  },
): Promise<void> {
  if (!mediaIds.length) return;
  const update: {
    transcription_status: string;
    transcription_updated_at: string;
    transcription_error: string | null;
    transcript?: string;
    transcription_audio_seconds?: number | null;
    transcription_started_at?: string;
  } = {
    transcription_status: patch.status,
    transcription_updated_at: new Date().toISOString(),
    transcription_error: patch.error ?? null,
  };
  if (patch.transcript !== undefined) update.transcript = patch.transcript;
  if (patch.seconds !== undefined) update.transcription_audio_seconds = patch.seconds;
  if (patch.status === "pending") update.transcription_started_at = new Date().toISOString();
  const { error } = await supabase.from("media").update(update).in("id", mediaIds);
  if (error) throw new Error(`Enregistrement du transcript impossible : ${error.message}`);
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ExistingAudio {
  id: string;
  file_name: string;
  file_size: number | null;
  file_url: string;
  content_hash: string | null;
  transcript: string | null;
  created_at: string;
}

/**
 * Doublon = même empreinte, ou (pour les anciennes lignes sans empreinte)
 * même nom et même taille. Préfère une copie déjà transcrite.
 */
export function findDuplicateAudio(
  existing: ExistingAudio[],
  file: { name: string; size: number },
  hash: string,
): ExistingAudio | null {
  const matches = existing.filter((e) =>
    e.content_hash ? e.content_hash === hash : e.file_name === file.name && e.file_size === file.size,
  );
  if (!matches.length) return null;
  return matches.find((m) => m.transcript && m.transcript.trim()) ?? matches[0];
}

/** Clé de regroupement des copies d'un même fichier. */
export function audioGroupKey(m: { content_hash: string | null; file_name: string; file_size: number | null }): string {
  return `${m.file_name}::${m.file_size ?? ""}`;
}
