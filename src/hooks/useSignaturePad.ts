/**
 * Reusable hook for managing a SignaturePad canvas.
 *
 * Handles:
 * - Canvas initialization with proper DPI scaling
 * - Clear / isEmpty / toDataURL helpers
 * - "First stroke" tracking callback
 * - Cleanup on unmount
 */
import { useEffect, useRef, useCallback } from "react";
import SignaturePad from "signature_pad";

interface UseSignaturePadOptions {
  /** Called once when the user starts drawing for the first time */
  onFirstStroke?: () => void;
  /** Pen color — default "rgb(0, 0, 0)" */
  penColor?: string;
  /** Background color — default "rgb(255, 255, 255)" */
  backgroundColor?: string;
}

export function useSignaturePad(options: UseSignaturePadOptions = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const hasTrackedFirstStroke = useRef(false);

  // Initialize pad when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: options.backgroundColor ?? "rgb(255, 255, 255)",
      penColor: options.penColor ?? "rgb(0, 0, 0)",
    });

    if (options.onFirstStroke) {
      pad.addEventListener("beginStroke", () => {
        if (!hasTrackedFirstStroke.current) {
          options.onFirstStroke?.();
          hasTrackedFirstStroke.current = true;
        }
      });
    }

    padRef.current = pad;

    return () => {
      pad.off();
      padRef.current = null;
    };
    // We intentionally only run this once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(() => {
    padRef.current?.clear();
    hasTrackedFirstStroke.current = false;
  }, []);

  const isEmpty = useCallback(() => {
    return padRef.current?.isEmpty() ?? true;
  }, []);

  const toDataURL = useCallback((type: string = "image/png") => {
    return padRef.current?.toDataURL(type) ?? "";
  }, []);

  return {
    /** Attach this ref to your <canvas> element */
    canvasRef,
    /** Direct access to the SignaturePad instance (use sparingly) */
    padRef,
    /** Clear the signature and reset first-stroke tracking */
    clear,
    /** Check if the pad is empty */
    isEmpty,
    /** Export the signature as a data URL */
    toDataURL,
  };
}
