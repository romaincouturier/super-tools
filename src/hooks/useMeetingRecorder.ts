import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { transcribeAudio } from "@/services/lmsMediaImport";
import { toast } from "sonner";

interface UseMeetingRecorderOptions {
  /** Called once with the full transcript after the recording is processed. */
  onTranscript: (text: string) => void;
  /** Mission id, used to namespace the uploaded file. */
  missionId: string;
  /** Safety auto-stop (ms). Default 2h. */
  maxDurationMs?: number;
}

type Status = "idle" | "recording" | "uploading" | "transcribing";

function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/mp4";
}

/**
 * Records a meeting by mixing the user's microphone with the system/desktop
 * audio stream (the same flow OBS uses, but in the browser). The mixed track is
 * uploaded to the private `meeting-recordings` bucket, transcribed via
 * AssemblyAI (submit + poll), then the file is deleted.
 *
 * Capturing system audio requires `getDisplayMedia` with the "share audio" box
 * ticked. Only works on Chrome/Edge desktop (Windows: share the whole screen;
 * a tab share also works). Returns `isSupported: false` elsewhere.
 */
export function useMeetingRecorder({
  onTranscript,
  missionId,
  maxDurationMs = 7_200_000, // 2h
}: UseMeetingRecorderOptions) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const cleanupCapture = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const baseMime = (recorder.mimeType || "audio/webm").split(";")[0].trim();
        const blob = new Blob(chunksRef.current, { type: baseMime });
        chunksRef.current = [];
        recorderRef.current = null;
        cleanupCapture();

        if (blob.size < 1000) {
          setStatus("idle");
          toast.info("Enregistrement trop court");
          resolve();
          return;
        }

        let storagePath: string | null = null;
        try {
          setStatus("uploading");
          // Upload via edge function (project rule: no direct storage.upload in src).
          const ext = baseMime === "audio/mp4" ? "mp4" : "webm";
          const form = new FormData();
          form.append("missionId", missionId);
          form.append("file", new File([blob], `meeting.${ext}`, { type: baseMime }));

          const { data: up, error: upErr } = await supabase.functions.invoke(
            "upload-meeting-recording",
            { body: form },
          );
          if (upErr) throw upErr;
          const signedUrl = (up as { signed_url?: string } | null)?.signed_url;
          storagePath = (up as { path?: string } | null)?.path ?? null;
          if (!signedUrl) throw new Error("URL d'enregistrement indisponible");

          setStatus("transcribing");
          const transcript = await transcribeAudio(signedUrl);

          if (transcript && transcript.trim()) {
            onTranscriptRef.current(transcript.trim());
          } else {
            toast.info("Aucune parole détectée dans l'enregistrement");
          }
        } catch (err: unknown) {
          console.error("Meeting transcription error:", err);
          toast.error("Erreur de transcription : " + (err instanceof Error ? err.message : "inconnue"));
        } finally {
          if (storagePath) {
            supabase.storage.from("meeting-recordings").remove([storagePath]).catch(() => {});
          }
          setStatus("idle");
          setElapsedMs(0);
          resolve();
        }
      };
      recorder.stop();
    });
  }, [cleanupCapture, missionId]);

  const start = useCallback(async () => {
    if (status !== "idle") {
      if (status === "recording") await stop();
      return;
    }

    let displayStream: MediaStream;
    try {
      // Must request video for getDisplayMedia; we only consume the audio track.
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return; // user cancelled the picker
      toast.error("Impossible de démarrer le partage d'écran");
      return;
    }

    if (displayStream.getAudioTracks().length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      toast.error(
        "Aucun audio système capté. Relancez et cochez « Partager l'audio » (sous Windows, partagez tout l'écran).",
        { duration: 9000 },
      );
      return;
    }

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      displayStream.getTracks().forEach((t) => t.stop());
      toast.error("Accès au micro refusé. Vérifiez les permissions du navigateur.");
      return;
    }

    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;
    chunksRef.current = [];

    // Mix system audio + mic into a single track via Web Audio API.
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaStreamSource(displayStream).connect(dest);
    audioCtx.createMediaStreamSource(micStream).connect(dest);

    const recorder = new MediaRecorder(dest.stream, { mimeType: pickMimeType() });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = recorder;
    recorder.start(1000);

    setStatus("recording");
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);

    // Auto-stop if the user ends the screen share from the browser's native bar.
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => { stop(); });

    // Safety auto-stop.
    timeoutRef.current = setTimeout(() => { stop(); }, maxDurationMs);
  }, [status, stop, maxDurationMs]);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  return {
    isSupported,
    isRecording: status === "recording",
    isProcessing: status === "uploading" || status === "transcribing",
    status,
    elapsedMs,
    start,
    stop,
  };
}
