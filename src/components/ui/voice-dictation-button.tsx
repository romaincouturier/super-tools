import * as React from "react";
import { Mic, MicOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";

export interface VoiceDictationButtonProps
  extends Omit<ButtonProps, "onClick" | "variant" | "children"> {
  /** Called once with the transcribed text after the user stops recording. */
  onTranscript: (text: string) => void;
  /** Max recording duration before auto-stop (ms). Default 5 min. */
  maxDurationMs?: number;
  /** Variant used when the button is idle (default: "outline"). Recording always uses "destructive". */
  idleVariant?: ButtonProps["variant"];
  /** Tooltip shown when idle (default "Dicter à la voix"). */
  idleTitle?: string;
}

/**
 * Generic voice dictation button — drop it next to any text input or inside any
 * editor toolbar (Tiptap, etc.). Owns its own {@link useVoiceDictation} hook, so
 * the parent only needs to wire `onTranscript`:
 *
 *   <VoiceDictationButton
 *     onTranscript={(t) => editor.chain().focus().insertContent(t).run()}
 *   />
 *
 * Renders nothing if the browser does not support media recording.
 *
 * For a textarea-bound use case, prefer {@link VoiceTextarea} which integrates
 * the same dictation flow with inline status indicators.
 */
const VoiceDictationButton = React.forwardRef<HTMLButtonElement, VoiceDictationButtonProps>(
  (
    {
      onTranscript,
      maxDurationMs,
      idleVariant = "outline",
      idleTitle = "Dicter à la voix",
      className,
      size = "icon",
      disabled,
      ...props
    },
    ref,
  ) => {
    const { isRecording, isTranscribing, isSupported, startRecording, stopRecording } =
      useVoiceDictation({ onTranscript, maxDurationMs });

    if (!isSupported) return null;

    const handleClick = () => {
      if (isRecording) stopRecording();
      else startRecording();
    };

    const title = isRecording
      ? "Arrêter la dictée"
      : isTranscribing
        ? "Transcription en cours…"
        : idleTitle;

    return (
      <Button
        ref={ref}
        type="button"
        variant={isRecording ? "destructive" : idleVariant}
        size={size}
        className={cn(isRecording && "animate-pulse", className)}
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        title={title}
        aria-label={title}
        {...props}
      >
        {isTranscribing ? (
          <Spinner />
        ) : isRecording ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
    );
  },
);
VoiceDictationButton.displayName = "VoiceDictationButton";

export { VoiceDictationButton };
