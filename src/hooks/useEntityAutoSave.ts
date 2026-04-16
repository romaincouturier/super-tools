import { useEffect, useCallback } from "react";
import { useAutoSaveForm, type AutoSaveFormValues } from "@/hooks/useAutoSaveForm";

export interface UseEntityAutoSaveOptions<T extends { id: string }> {
  /** The entity being edited. `null` when no entity is selected. */
  entity: T | null;
  /** Whether the drawer/dialog is open. */
  open: boolean;
  /** Current form values (must be memoized by the caller). */
  formValues: AutoSaveFormValues;
  /**
   * Hydrate local form state from an entity. Called when `entity.id`
   * changes (i.e. a new entity is opened in the drawer).
   */
  setFromEntity: (entity: T) => void;
  /**
   * Persist the values for the given entity. Receives the entity id (we
   * already guarantee `entity` was non-null before calling) and the form
   * values. Throw to mark the save as failed.
   */
  onSave: (entityId: string, values: AutoSaveFormValues) => Promise<void>;
  /** Debounce in ms (default 800, same as useAutoSaveForm). */
  debounceMs?: number;
}

export interface UseEntityAutoSaveReturn {
  autoSaving: boolean;
  lastSaved: Date | null;
}

/**
 * Drawer-friendly wrapper around `useAutoSaveForm` that captures the
 * three boilerplate pieces every entity drawer reimplements:
 *
 *  1. Hydrate local form state from the entity when it changes.
 *  2. Auto-save (debounced + dirty-checked) while the drawer is open.
 *  3. Flush any pending change when the drawer closes.
 *
 * Caller still owns the local `useState`s and the `formValues` memo —
 * this hook does NOT prescribe the shape of the form, only the lifecycle.
 *
 * Pattern eliminated:
 *   useEffect([entityId]) { setX(entity.x); ...; resetTracking(); }
 *   const handleAutoSave = useCallback(async (v) => { try { await mutation.mutateAsync({...}); return true; } catch { return false } }, [...]);
 *   const { resetTracking, flushAndGetPending } = useAutoSaveForm({...});
 *   useEffect([open]) { if (!open) { const p = flushAndGetPending(); if (p) mutation.mutate({...}); } }
 */
export function useEntityAutoSave<T extends { id: string }>({
  entity,
  open,
  formValues,
  setFromEntity,
  onSave,
  debounceMs,
}: UseEntityAutoSaveOptions<T>): UseEntityAutoSaveReturn {
  const handleAutoSave = useCallback(
    async (values: AutoSaveFormValues) => {
      if (!entity) return false;
      try {
        await onSave(entity.id, values);
        return true;
      } catch {
        return false;
      }
    },
    [entity, onSave],
  );

  const { autoSaving, lastSaved, resetTracking, flushAndGetPending } = useAutoSaveForm({
    open,
    formValues,
    onSave: handleAutoSave,
    debounceMs,
  });

  // Hydrate from entity on entity change.
  const entityId = entity?.id;
  useEffect(() => {
    if (entity) {
      setFromEntity(entity);
      resetTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Flush pending save when drawer closes.
  useEffect(() => {
    if (!open && entity) {
      const pending = flushAndGetPending();
      if (pending) {
        // Best-effort: don't await, the drawer is closing anyway.
        void onSave(entity.id, pending);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { autoSaving, lastSaved };
}
