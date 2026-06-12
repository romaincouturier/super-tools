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

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("transcribe-audio-long", {
    body: { audio_url: audioUrl },
  });
  if (error) throw new Error(error.message);
  return (data as { transcript?: string })?.transcript ?? "";
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
