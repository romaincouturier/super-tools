import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";

interface Props {
  onTranscript: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}

export default function StaffCommentDictation({ onTranscript, onBusyChange, disabled }: Props) {
  const { isRecording, isTranscribing, isSupported, startRecording, stopRecording } =
    useVoiceDictation({ onTranscript });
  const busy = isRecording || isTranscribing;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  if (!isSupported) return null;
  const label = isRecording ? "Arrêter la dictée" : isTranscribing ? "Transcription en cours…" : "Dicter le commentaire";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "ghost"}
            className="h-8 w-8 shrink-0"
            aria-label={label}
            aria-pressed={isRecording}
            disabled={disabled || (isTranscribing && !isRecording)}
            onClick={() => { if (isRecording) void stopRecording(); else void startRecording(); }}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : isTranscribing ? <Spinner size="sm" /> : <Mic className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}