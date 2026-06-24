import { AudioLines, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";

interface MeetingRecorderButtonProps {
  missionId: string;
  /** Called once with the full transcript after processing. */
  onTranscript: (text: string) => void;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Toolbar button that records the meeting audio (microphone + system/desktop
 * audio) and inserts the transcript. Use for Teams/Meet calls where the user is
 * only a participant and cannot trigger native recording. Hidden on browsers
 * without `getDisplayMedia` (Firefox/Safari/mobile).
 */
export function MeetingRecorderButton({ missionId, onTranscript }: MeetingRecorderButtonProps) {
  const { isSupported, isRecording, isProcessing, status, elapsedMs, start, stop } =
    useMeetingRecorder({ onTranscript, missionId });

  if (!isSupported) return null;

  const title = isRecording
    ? "Arrêter l'enregistrement de la réunion"
    : isProcessing
      ? "Transcription en cours…"
      : "Enregistrer la réunion (micro + audio système)";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => (isRecording ? stop() : start())}
        disabled={isProcessing}
        title={title}
        aria-label={title}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded transition-colors",
          isRecording
            ? "bg-red-100 text-red-600 animate-pulse"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          isProcessing && "opacity-50 pointer-events-none",
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isRecording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <AudioLines className="h-3.5 w-3.5" />
        )}
      </button>
      {isRecording && (
        <span className="text-xs font-mono text-red-600 tabular-nums">{formatElapsed(elapsedMs)}</span>
      )}
      {isProcessing && (
        <span className="text-xs text-muted-foreground">
          {status === "uploading" ? "Envoi…" : "Transcription…"}
        </span>
      )}
    </div>
  );
}
