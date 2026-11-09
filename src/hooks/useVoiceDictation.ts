import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { transcribeDictation, type DictationContext } from "@/services/voiceDictation";
import { ContinuousRecording } from "@/services/continuousRecording";
import { toast } from "@/lib/toast";

interface UseVoiceDictationOptions {
  onTranscript: (text: string) => void | Promise<void>;
  maxDurationMs?: number;
  context?: DictationContext;
}

export function useVoiceDictation({ onTranscript, maxDurationMs = 300000, context }: UseVoiceDictationOptions) {
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<ContinuousRecording>();
  const busyRef = useRef(false);
  const pendingRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const contextRef = useRef(context);
  contextRef.current = context;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const audioContextRef = useRef<AudioContext>();
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const stopSilenceDetection = useCallback(() => {
    clearInterval(silenceIntervalRef.current);
    silenceIntervalRef.current = undefined;
    void audioContextRef.current?.close();
    audioContextRef.current = undefined;
  }, []);

  const stopRecording = useCallback(async () => {
    stopSilenceDetection();
    const recording = recordingRef.current;
    recordingRef.current = undefined;
    if (mountedRef.current) setIsRecording(false);
    await recording?.stop();
  }, [stopSilenceDetection]);

  const startRecording = useCallback(async () => {
    if (recordingRef.current) { await stopRecording(); return; }
    if (busyRef.current || pendingRef.current) return;
    busyRef.current = true;
    const recordingContext = contextRef.current;
    const deliver = onTranscriptRef.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recording = new ContinuousRecording(stream, mimeType, Math.max(1000, maxDurationMs), (blob) => {
        pendingRef.current += 1;
        if (mountedRef.current) setIsTranscribing(true);
        const task = queueRef.current.then(async () => {
          try {
            const transcript = await transcribeDictation(blob, recordingContext);
            await (mountedRef.current ? onTranscriptRef.current : deliver)(transcript);
          } catch (error) {
            console.error("Transcription error:", error);
            toast.error("Erreur de transcription : " + (error instanceof Error ? error.message : "inconnue"), {
              duration: Infinity,
              action: { label: "Sauver l’audio", onClick: () => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `dictee-${Date.now()}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              } },
            });
          } finally {
            pendingRef.current -= 1;
            if (mountedRef.current) setIsTranscribing(pendingRef.current > 0);
            void queryClient.invalidateQueries({ queryKey: ["entity-transcripts"] });
            void queryClient.invalidateQueries({ queryKey: ["transcript-assignments"] });
            void queryClient.invalidateQueries({ queryKey: ["transcripts"] });
          }
        });
        queueRef.current = task;
        return task;
      }, (error) => {
        toast.error("Le microphone s’est interrompu. Les segments déjà enregistrés sont conservés.");
        console.error("Recording error:", error);
        void stopRecording();
      });
      recordingRef.current = recording;
      recording.start();
      setIsRecording(true);
      try {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        let silentMs = 0;
        let warningShown = false;
        silenceIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(buffer);
          const avg = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
          if (avg < 8) {
            silentMs += 100;
            if (silentMs >= 5000 && !warningShown) {
              warningShown = true;
              toast.warning("Vous n'êtes pas audible. Vérifiez que votre microphone est activé et sélectionné.", { duration: 8000 });
            }
          } else { silentMs = 0; }
        }, 100);
      } catch { /* La capture ne dépend pas du détecteur de silence. */ }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      recordingRef.current = undefined;
      toast.error(error instanceof Error && error.name === "NotAllowedError"
        ? "Accès au micro refusé. Vérifiez les permissions du navigateur."
        : "Impossible de démarrer l'enregistrement");
      setIsRecording(false);
    } finally { busyRef.current = false; }
  }, [maxDurationMs, queryClient, stopRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; void stopRecording(); };
  }, [stopRecording]);

  const isSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  return { isRecording, isTranscribing, isSupported, startRecording, stopRecording };
}
