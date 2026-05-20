import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so stopAndTranscribe / startRecording don't cascade-recreate
  // every time the caller passes a new onTranscript function.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stopSilenceDetection = useCallback(() => {
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    stopSilenceDetection();

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

        // Send audio directly to the transcription function to avoid browser-side Storage RLS.
        setIsTranscribing(true);
        try {
          // Strip codec parameter (e.g. "audio/webm;codecs=opus") — Supabase
          // bucket allowed_mime_types matches the base mime exactly.
          const baseMime = (blob.type || "audio/mp4").split(";")[0].trim();
          // The Storage API validates the Blob/File MIME type itself, not only
          // the explicit contentType option. MediaRecorder often returns
          // "audio/webm;codecs=opus", while the bucket allow-list contains the
          // normalized "audio/webm" value.
          const uploadBlob = blob.type === baseMime ? blob : new Blob([blob], { type: baseMime });
          const audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
            reader.onerror = () => reject(reader.error ?? new Error("Lecture audio impossible"));
            reader.readAsDataURL(uploadBlob);
          });

          const { data, error } = await supabase.functions.invoke("transcribe-audio-long", {
            body: { audio_base64: audioBase64, content_type: baseMime },
          });

          if (error) throw error;

          const transcript = data?.transcript;
          if (transcript && transcript !== "[inaudible]") {
            onTranscriptRef.current(transcript);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSilenceDetection]);

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

      // Silence detection via Web Audio API
      try {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const SILENCE_THRESHOLD = 8; // 0–255 scale, ~3% — distingue silence vs voix
        const SILENCE_DELAY_MS = 5000;
        let silentMs = 0;
        let warningShown = false;

        silenceIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(buffer);
          const avg = buffer.reduce((s, v) => s + v, 0) / buffer.length;
          if (avg < SILENCE_THRESHOLD) {
            silentMs += 100;
            if (silentMs >= SILENCE_DELAY_MS && !warningShown) {
              warningShown = true;
              toast.warning(
                "Vous n'êtes pas audible. Avez-vous commencé à parler ? Vérifiez que votre microphone est bien activé et sélectionné.",
                { duration: 8000 }
              );
            }
          } else {
            silentMs = 0;
          }
        }, 100);
      } catch {
        // Web Audio non supporté — pas bloquant, on ignore
      }

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
