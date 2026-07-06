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

export interface AudioAssignment {
  audio_id: string;
  lesson_id: string | null;
  reformulated_text: string;
  key_points: string[];
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
export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Step 1: submit the job
  const submitRes = await supabase.functions.invoke("transcribe-audio-long", {
    body: { mode: "submit", audio_url: audioUrl },
  });
  if (submitRes.error) throw await extractFunctionError(submitRes.error, "transcribe-audio-long:submit");
  const transcriptId = (submitRes.data as { transcript_id?: string })?.transcript_id;
  if (!transcriptId) throw new Error("Aucun transcript_id reçu de transcribe-audio-long");

  // Step 2: poll until completion (client-side, no wall-time issue)
  const MAX_POLLS = 180; // 180 * 5s = 15 min
  const POLL_INTERVAL = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const pollRes = await supabase.functions.invoke("transcribe-audio-long", {
      body: { mode: "poll", transcript_id: transcriptId },
    });
    if (pollRes.error) throw await extractFunctionError(pollRes.error, "transcribe-audio-long:poll");
    const data = pollRes.data as { status: string; transcript?: string; error?: string };
    if (data.status === "completed") return data.transcript ?? "";
    if (data.status === "error") throw new Error(`Transcription échouée : ${data.error || "raison inconnue"}`);
    // queued / processing -> keep polling
  }

  throw new Error("Transcription timeout après 15 minutes");
}

export async function analyzeAudioForLessons(
  transcripts: AudioTranscript[],
  lessons: LessonInfo[],
): Promise<AudioAssignment[]> {
  const { data, error } = await supabase.functions.invoke("lms-analyze-audio", {
    body: { transcripts, lessons },
  });
  if (error) throw await extractFunctionError(error, "lms-analyze-audio");
  const assignments = (data as { assignments?: AudioAssignment[] })?.assignments;
  if (!assignments) {
    throw new Error("Réponse IA invalide : champ 'assignments' manquant");
  }
  return assignments;
}
