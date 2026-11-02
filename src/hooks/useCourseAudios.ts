import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  audioGroupKey,
  resolveAudioStatus,
  type MediaTranscriptionStatus,
} from "@/services/lmsMediaImport";

interface MediaRow {
  id: string;
  file_name: string;
  file_size: number | null;
  file_url: string;
  content_hash: string | null;
  transcript: string | null;
  transcription_status: string | null;
  transcription_error: string | null;
  transcription_audio_seconds: number | null;
  created_at: string;
}

export interface CourseAudio {
  key: string;
  mediaIds: string[];
  file_name: string;
  file_url: string;
  created_at: string;
  transcript: string | null;
  seconds: number | null;
  error: string | null;
  status: MediaTranscriptionStatus;
  blocks: number;
  lessons: string[];
}

async function fetchCourseAudios(courseId: string): Promise<CourseAudio[]> {
  const { data, error } = await supabase
    .from("media")
    .select("id, file_name, file_size, file_url, content_hash, transcript, transcription_status, transcription_error, transcription_audio_seconds, created_at")
    .eq("source_type", "lms")
    .eq("source_id", courseId)
    .eq("file_type", "audio")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as MediaRow[];
  const ids = rows.map((r) => r.id);
  const { data: blocks } = ids.length
    ? await supabase.from("lms_lesson_blocks").select("source_media_id, lms_lessons(title)").in("source_media_id", ids)
    : { data: [] };

  const groups = new Map<string, MediaRow[]>();
  for (const r of rows) {
    const k = audioGroupKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([key, copies]) => {
    const best = copies.find((c) => c.transcript?.trim()) ?? copies[0];
    const ownBlocks = ((blocks ?? []) as { source_media_id: string; lms_lessons: { title: string } | null }[])
      .filter((b) => copies.some((c) => c.id === b.source_media_id));
    const statusRow = copies.find((c) => c.transcription_status === "processed") ?? best;
    return {
      key,
      mediaIds: copies.map((c) => c.id),
      file_name: best.file_name,
      file_url: best.file_url,
      created_at: copies[0].created_at,
      transcript: best.transcript,
      seconds: best.transcription_audio_seconds,
      error: best.transcription_error,
      status: resolveAudioStatus({ transcript: best.transcript, transcription_status: statusRow.transcription_status, blocks_count: ownBlocks.length }),
      blocks: ownBlocks.length,
      lessons: [...new Set(ownBlocks.map((b) => b.lms_lessons?.title).filter((t): t is string => !!t))],
    };
  });
}

export function useCourseAudios(courseId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["lms-course-audios", courseId],
    queryFn: () => fetchCourseAudios(courseId),
    enabled,
  });
}
