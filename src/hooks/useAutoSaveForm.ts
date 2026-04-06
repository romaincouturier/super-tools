import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export interface AutoSaveFormValues {
  [key: string]: unknown;
}

export interface UseAutoSaveFormOptions {
  /** Whether the form is currently open/active */
  open: boolean;
  /** Current form values to track */
  formValues: AutoSaveFormValues;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Called when save should be performed. Return true if save succeeded. */
  onSave: (values: AutoSaveFormValues) => Promise<boolean>;
}

export interface UseAutoSaveFormReturn {
  autoSaving: boolean;
  lastSaved: Date | null;
  resetTracking: () => void;
  formHash: string;
  flushAndGetPending: () => AutoSaveFormValues | null;
}

export function useAutoSaveForm({
  open,
  formValues,
  debounceMs = 800,
  onSave,
}: UseAutoSaveFormOptions): UseAutoSaveFormReturn {
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedHashRef = useRef("");
  const formValuesRef = useRef<AutoSaveFormValues>({});

  // Always keep latest values in ref
  formValuesRef.current = formValues;

  // Compute hash only when formValues object reference changes (caller should useMemo)
  const formHash = useMemo(() => JSON.stringify(formValues), [formValues]);

  const resetTracking = useCallback(() => {
    lastSavedHashRef.current = "";
    setLastSaved(null);
  }, []);

  const flushAndGetPending = useCallback((): AutoSaveFormValues | null => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      if (formHash !== lastSavedHashRef.current) {
        return formValuesRef.current;
      }
    }
    return null;
  }, [formHash]);

  useEffect(() => {
    if (!open) return;
    if (formHash === lastSavedHashRef.current) return;

    if (!lastSavedHashRef.current) {
      lastSavedHashRef.current = formHash;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const success = await onSave(formValuesRef.current);
        if (success) {
          lastSavedHashRef.current = formHash;
          setLastSaved(new Date());
        }
      } catch (error: unknown) {
        console.error(
          "Auto-save error:",
          error instanceof Error ? error.message : "Erreur inconnue",
        );
      } finally {
        setAutoSaving(false);
      }
    }, debounceMs);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formHash, open]);

  return {
    autoSaving,
    lastSaved,
    resetTracking,
    formHash,
    flushAndGetPending,
  };
}
