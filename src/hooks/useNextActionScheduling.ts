/**
 * Shared state + handlers for the "Programmer une action" UX rendered by
 * `NextActionScheduler`. Used by both CRM opportunities and missions.
 *
 * The caller provides:
 *  - `entityKey` — typically the entity ID, used to reset the local form
 *    state when a different entity is opened in the drawer.
 *  - `currentDate` / `currentText` — the entity's currently persisted
 *    scheduled action (nullable). Seeds the form on entity change.
 *  - `save({ date, text })` — persists a new scheduled action.
 *  - `clear()` — unschedules the current action.
 *  - `markDone?(text)` — optional. When provided, the banner renders a ✓
 *    button. Missions use this to append a row into their activity feed;
 *    CRM doesn't define it (clearing IS the "done" state there).
 *
 * Validation and error toasts are handled here so both entities stay in
 * sync when the UX evolves.
 */
import { useState, useEffect } from "react";
import { startOfDay, isBefore } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export interface UseNextActionSchedulingOptions {
  entityKey: string | undefined;
  currentDate: string | null;
  currentText: string | null;
  save: (values: { date: string; text: string }) => Promise<void>;
  clear: () => Promise<void>;
  markDone?: (currentText: string) => Promise<void>;
  /** Optional success toast shown after markDone succeeds. */
  markDoneSuccessToast?: { title: string; description?: string };
}

export function useNextActionScheduling({
  entityKey,
  currentDate,
  currentText,
  save,
  clear,
  markDone,
  markDoneSuccessToast,
}: UseNextActionSchedulingOptions) {
  const { toast } = useToast();
  const [scheduledDate, setScheduledDate] = useState(currentDate ?? "");
  const [scheduledText, setScheduledText] = useState(currentText ?? "");
  const [showForm, setShowForm] = useState(false);

  // Reset form when a different entity is opened in the drawer.
  useEffect(() => {
    setScheduledDate(currentDate ?? "");
    setScheduledText(currentText ?? "");
    setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledText.trim()) return;
    const selectedDate = startOfDay(new Date(scheduledDate));
    const today = startOfDay(new Date());
    if (isBefore(selectedDate, today)) {
      toast({
        title: "Date invalide",
        description: "La date ne peut pas être dans le passé.",
        variant: "destructive",
      });
      return;
    }
    try {
      await save({ date: scheduledDate, text: scheduledText.trim() });
      setShowForm(false);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de programmer l'action.",
        variant: "destructive",
      });
    }
  };

  const handleClear = async () => {
    setScheduledDate("");
    setScheduledText("");
    try {
      await clear();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la programmation.",
        variant: "destructive",
      });
    }
  };

  const handleMarkDone = markDone
    ? async () => {
        if (!currentText) return;
        try {
          await markDone(currentText);
          setScheduledDate("");
          setScheduledText("");
          if (markDoneSuccessToast) {
            toast(markDoneSuccessToast);
          }
        } catch {
          toast({
            title: "Erreur",
            description: "Impossible de marquer l'action comme faite.",
            variant: "destructive",
          });
        }
      }
    : undefined;

  return {
    scheduledDate,
    setScheduledDate,
    scheduledText,
    setScheduledText,
    showForm,
    setShowForm,
    handleSchedule,
    handleClear,
    handleMarkDone,
  };
}
