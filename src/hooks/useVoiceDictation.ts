import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface UseVoiceDictationOptions {
  onTranscript: (text: string) => void;
  maxDurationMs?: number;
}

export function useVoiceDictation({
  onTranscript,
  maxDurationMs = 300000, // 5 minutes par défaut
}: UseVoiceDictationOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAndTranscribe = useCallback(async () => {
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }

    // Wait for onstop to fire with collected data
    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        // Stop media stream tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          toast.info("Enregistrement trop court");
          resolve();
          return;
        }

        // Transcribe
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, `recording.${blob.type.includes("webm") ? "webm" : "mp4"}`);

          const { data, error } = await supabase.functions.invoke("transcribe-audio", {
            body: formData,
          });

          if (error) throw error;

          const transcript = data?.transcript;
          if (transcript && transcript !== "[inaudible]") {
            onTranscript(transcript);
          } else {
            toast.info("Aucune parole détectée");
          }
        } catch (err: unknown) {
          console.error("Transcription error:", err);
          toast.error("Erreur de transcription : " + (err instanceof Error ? err.message : "inconnue"));
        } finally {
          setIsTranscribing(false);
        }
        resolve();
      };

      recorder.stop();
    });
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      await stopAndTranscribe();
      return;
    }

    try {
      // CRITICAL: getUserMedia directly in click handler
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopAndTranscribe();
      }, maxDurationMs);
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        toast.error("Accès au micro refusé. Vérifiez les permissions du navigateur.");
      } else {
        toast.error("Impossible de démarrer l'enregistrement");
        console.error("Recording error:", error);
      }
      setIsRecording(false);
    }
  }, [isRecording, stopAndTranscribe, maxDurationMs]);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  return {
    isRecording,
    isTranscribing,
    isSupported,
    startRecording,
    stopRecording: stopAndTranscribe,
  };
}
