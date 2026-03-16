import { useState, useRef, useCallback } from "react";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useSpeechRecognition(lang: string = "fr-FR", continuous: boolean = false) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const intentionalStopRef = useRef(false);

  const isSupported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      if (!isSupported) return;

      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;

      // Stop any existing instance first
      if (recognitionRef.current) {
        intentionalStopRef.current = true;
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }

      onResultRef.current = onResult;
      intentionalStopRef.current = false;

      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = continuous;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            fullTranscript += event.results[i][0].transcript;
          }
        }
        if (fullTranscript) {
          onResultRef.current?.(fullTranscript);
        }
      };

      recognition.onerror = (e: any) => {
        const errorType = e?.error || "unknown";
        console.error("[SpeechRecognition] error:", errorType, e);

        // "no-speech" is not fatal in continuous mode — just restart
        if (continuous && errorType === "no-speech" && !intentionalStopRef.current) {
          console.log("[SpeechRecognition] no-speech, will restart on end");
          return;
        }

        // "aborted" can happen on page navigation, ignore
        if (errorType === "aborted") {
          setIsListening(false);
          recognitionRef.current = null;
          return;
        }

        // Fatal errors
        if (errorType === "not-allowed") {
          console.error("[SpeechRecognition] Microphone permission denied");
        }

        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        console.log("[SpeechRecognition] onend, intentionalStop:", intentionalStopRef.current);

        // In continuous mode, auto-restart unless user clicked stop
        if (continuous && !intentionalStopRef.current && recognitionRef.current) {
          console.log("[SpeechRecognition] auto-restarting continuous session");
          try {
            recognition.start();
            return;
          } catch (err) {
            console.error("[SpeechRecognition] restart failed:", err);
          }
        }

        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
        setIsListening(true);
        console.log("[SpeechRecognition] started, lang:", lang, "continuous:", continuous);
      } catch (err) {
        console.error("[SpeechRecognition] start() failed:", err);
        setIsListening(false);
        recognitionRef.current = null;
      }
    },
    [isSupported, lang, continuous]
  );

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
