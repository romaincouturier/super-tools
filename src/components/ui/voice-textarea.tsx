import * as React from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";

export interface VoiceTextareaProps extends TextareaProps {
  /** Called with the new value (current + transcribed text) */
  onValueChange?: (value: string) => void;
}

/**
 * Textarea with an integrated voice dictation button.
 * Appends transcribed text to the current value.
 */
const VoiceTextarea = React.forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  ({ className, onValueChange, value, onChange, ...props }, ref) => {
    const { isRecording, isTranscribing, isSupported, startRecording, stopRecording } =
      useVoiceDictation({
        onTranscript: (text) => {
          const current = String(value ?? "");
          const next = current ? current + "\n" + text : text;
          onValueChange?.(next);
        },
      });

    const handleToggleMic = () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Textarea
            ref={ref}
            value={value}
            onChange={onChange}
            className={cn(isSupported && "pr-14", className)}
            {...props}
          />
          {isSupported && (
            <Button
              type="button"
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className="absolute top-3 right-3 h-8 w-8"
              onClick={handleToggleMic}
              disabled={isTranscribing}
              title={isRecording ? "Arrêter la dictée" : "Dicter"}
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
            <div className="w-2 h-2 bg-destructive rounded-full" />
            Enregistrement en cours...
          </div>
        )}
        {isTranscribing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Transcription en cours...
          </div>
        )}
      </div>
    );
  },
);
VoiceTextarea.displayName = "VoiceTextarea";

export { VoiceTextarea };
