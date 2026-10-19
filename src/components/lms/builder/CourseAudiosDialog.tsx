import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  audioGroupKey,
  resolveAudioStatus,
  setMediaTranscription,
  transcribeAudio,
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

const STATUS_LABEL: Record<MediaTranscriptionStatus, { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  transcribed: { label: "Transcrit", variant: "secondary" },
  processed: { label: "Traité en blocs", variant: "default" },
  error: { label: "Erreur", variant: "destructive" },
};

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

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\.[^.]+$/, "")} - transcript.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function CourseAudiosDialog({ open, onClose, courseId }: { open: boolean; onClose: () => void; courseId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const { data: audios = [], isLoading } = useQuery({
    queryKey: ["lms-course-audios", courseId],
    queryFn: () => fetchCourseAudios(courseId),
    enabled: open,
  });

  /** Transcription seule : aucun bloc n'est créé ni modifié. */
  const transcribe = async (a: CourseAudio) => {
    setRunning((s) => new Set(s).add(a.key));
    try {
      await setMediaTranscription(a.mediaIds, { status: "pending" });
      const { text, seconds } = await transcribeAudio(a.file_url);
      if (!text.trim()) {
        await setMediaTranscription(a.mediaIds, { status: "error", error: "Aucune parole détectée.", seconds });
      } else {
        await setMediaTranscription(a.mediaIds, { status: "transcribed", transcript: text, seconds });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erreur";
      await setMediaTranscription(a.mediaIds, { status: "error", error }).catch(() => undefined);
      toastError(toast, `${a.file_name} : ${error}`);
    } finally {
      setRunning((s) => { const n = new Set(s); n.delete(a.key); return n; });
      qc.invalidateQueries({ queryKey: ["lms-course-audios", courseId] });
    }
  };

  const missing = audios.filter((a) => !a.transcript?.trim());
  const transcribeAllMissing = async () => {
    for (const a of missing) await transcribe(a);
    toast({ title: "Rattrapage terminé" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mic className="h-4 w-4" /> Audios du cours</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
          <span>{audios.length} fichier{audios.length > 1 ? "s" : ""} · {missing.length} sans transcription</span>
          <Button size="sm" variant="outline" disabled={!missing.length || running.size > 0} onClick={transcribeAllMissing}>
            Transcrire tous les manquants
          </Button>
        </div>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : (
          <ul className="divide-y">
            {audios.map((a) => {
              const st = STATUS_LABEL[a.status];
              const busy = running.has(a.key);
              return (
                <li key={a.key} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{a.file_name}</span>
                      <Badge variant={st.variant}>{busy ? "Transcription…" : st.label}</Badge>
                      {a.mediaIds.length > 1 && <span className="text-xs text-muted-foreground">{a.mediaIds.length} copies</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} · {formatDuration(a.seconds)}
                      {a.blocks > 0 && ` · ${a.blocks} bloc${a.blocks > 1 ? "s" : ""} (${a.lessons.join(", ")})`}
                    </div>
                    {a.status === "error" && a.error && <div className="text-xs text-destructive mt-0.5">{a.error}</div>}
                  </div>
                  {a.transcript?.trim() ? (
                    <Button size="sm" variant="ghost" onClick={() => download(a.file_name, a.transcript!)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Transcript
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => transcribe(a)}>
                      {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Transcrire
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
