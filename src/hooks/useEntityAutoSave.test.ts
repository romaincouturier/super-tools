import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntityAutoSave } from "./useEntityAutoSave";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

type Entity = { id: string; name: string };

describe("useEntityAutoSave", () => {
  it("setFromEntity called when entity changes to non-null", () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const entity: Entity = { id: "1", name: "Test" };

    renderHook(() =>
      useEntityAutoSave({
        entity,
        open: true,
        formValues: { name: "Test" },
        setFromEntity,
        onSave,
      }),
    );

    expect(setFromEntity).toHaveBeenCalledWith(entity);
  });

  it("setFromEntity NOT called when entity is null", () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useEntityAutoSave({
        entity: null,
        open: true,
        formValues: { name: "" },
        setFromEntity,
        onSave,
      }),
    );

    expect(setFromEntity).not.toHaveBeenCalled();
  });

  it("onSave receives correct entityId and form values after debounce", async () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const entity: Entity = { id: "entity-42", name: "Initial" };
    const state = { formValues: { name: "Initial" } };

    const { rerender } = renderHook(() =>
      useEntityAutoSave({
        entity,
        open: true,
        formValues: state.formValues,
        setFromEntity,
        onSave,
        debounceMs: 800,
      }),
    );

    state.formValues = { name: "Baseline" };
    rerender();

    state.formValues = { name: "Updated" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).toHaveBeenCalledWith("entity-42", { name: "Updated" });
  });

  it("switching entity (new id) → setFromEntity called again with new entity", () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    let entity: Entity = { id: "1", name: "First" };

    const { rerender } = renderHook(() =>
      useEntityAutoSave({
        entity,
        open: true,
        formValues: { name: entity.name },
        setFromEntity,
        onSave,
      }),
    );

    expect(setFromEntity).toHaveBeenCalledTimes(1);
    expect(setFromEntity).toHaveBeenCalledWith({ id: "1", name: "First" });

    entity = { id: "2", name: "Second" };
    rerender();

    expect(setFromEntity).toHaveBeenCalledTimes(2);
    expect(setFromEntity).toHaveBeenCalledWith({ id: "2", name: "Second" });
  });

  it("drawer closes with pending changes → onSave called immediately (flush)", async () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const entity: Entity = { id: "flush-test", name: "Initial" };
    const state = { formValues: { name: "Initial" }, open: true };

    const { rerender } = renderHook(() =>
      useEntityAutoSave({
        entity,
        open: state.open,
        formValues: state.formValues,
        setFromEntity,
        onSave,
        debounceMs: 800,
      }),
    );

    // resetTracking() clears the baseline on mount → first change establishes new baseline
    state.formValues = { name: "Intermediate" };
    rerender();

    // Second change is genuinely dirty → timer is set
    state.formValues = { name: "Unsaved" };
    rerender();

    expect(onSave).not.toHaveBeenCalled();

    state.open = false;
    rerender();

    expect(onSave).toHaveBeenCalledWith("flush-test", { name: "Unsaved" });
  });

  it("drawer closes with no pending changes → onSave NOT called on close", async () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const entity: Entity = { id: "no-flush", name: "Initial" };
    let open = true;

    const { rerender } = renderHook(() =>
      useEntityAutoSave({
        entity,
        open,
        formValues: { name: "Initial" },
        setFromEntity,
        onSave,
        debounceMs: 800,
      }),
    );

    open = false;
    rerender();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("onSave throws → autoSaving resets to false, lastSaved stays null", async () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    const entity: Entity = { id: "err-test", name: "Initial" };
    let formValues = { name: "Initial" };

    const { result, rerender } = renderHook(() =>
      useEntityAutoSave({
        entity,
        open: true,
        formValues,
        setFromEntity,
        onSave,
        debounceMs: 800,
      }),
    );

    formValues = { name: "Changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.autoSaving).toBe(false);
    expect(result.current.lastSaved).toBeNull();
  });

  it("entity=null → handleAutoSave returns false, no onSave call", async () => {
    const setFromEntity = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    let formValues = { name: "Initial" };

    const { rerender } = renderHook(() =>
      useEntityAutoSave({
        entity: null,
        open: true,
        formValues,
        setFromEntity,
        onSave,
        debounceMs: 800,
      }),
    );

    formValues = { name: "Changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
