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
  onerror: ((event: any) => void) | null;
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

  const isSupported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      if (!isSupported) return;

      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;

      // Store callback in ref so it's always fresh
      onResultRef.current = onResult;

      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = continuous;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Collect all final results (iOS Safari accumulates them)
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        console.log("[SpeechRecognition] onresult fired, transcript:", fullTranscript);
        onResultRef.current?.(fullTranscript);
      };

      recognition.onerror = (e: any) => {
        console.error("[SpeechRecognition] error:", e);
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        console.log("[SpeechRecognition] onend fired");
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      console.log("[SpeechRecognition] started, lang:", lang, "continuous:", continuous);
    },
    [isSupported, lang, continuous]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
