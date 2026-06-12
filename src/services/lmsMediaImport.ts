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
 * Transcribe an audio file via AssemblyAI using the submit + poll pattern
 * to avoid edge function wall-time limits.
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Step 1: submit the job
  const submitRes = await supabase.functions.invoke("transcribe-audio-long", {
    body: { mode: "submit", audio_url: audioUrl },
  });
  if (submitRes.error) throw new Error(submitRes.error.message);
  const transcriptId = (submitRes.data as { transcript_id?: string })?.transcript_id;
  if (!transcriptId) throw new Error("Aucun transcript_id reçu");

  // Step 2: poll until completion (client-side, no wall-time issue)
  const MAX_POLLS = 180; // 180 * 5s = 15 min
  const POLL_INTERVAL = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const pollRes = await supabase.functions.invoke("transcribe-audio-long", {
      body: { mode: "poll", transcript_id: transcriptId },
    });
    if (pollRes.error) throw new Error(pollRes.error.message);
    const data = pollRes.data as { status: string; transcript?: string; error?: string };
    if (data.status === "completed") return data.transcript ?? "";
    if (data.status === "error") throw new Error(data.error || "Erreur de transcription");
    // queued / processing -> keep polling
  }

  throw new Error("Transcription timeout");
}

export async function analyzeAudioForLessons(
  transcripts: AudioTranscript[],
  lessons: LessonInfo[],
): Promise<AudioAssignment[]> {
  const { data, error } = await supabase.functions.invoke("lms-analyze-audio", {
    body: { transcripts, lessons },
  });
  if (error) throw new Error(error.message);
  return (data as { assignments?: AudioAssignment[] })?.assignments ?? [];
}
