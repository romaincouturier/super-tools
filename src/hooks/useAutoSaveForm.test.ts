import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSaveForm } from "./useAutoSaveForm";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutoSaveForm", () => {
  it("initial state: autoSaving=false, lastSaved=null", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues: { name: "test" },
        onSave,
      }),
    );
    expect(result.current.autoSaving).toBe(false);
    expect(result.current.lastSaved).toBeNull();
  });

  it("first render sets baseline hash without triggering save", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues: { name: "initial" },
        onSave,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("value change while open=true debounces then calls onSave after timer fires", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "changed" };
    rerender();

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ name: "changed" });
  });

  it("onSave returns true → lastSaved updated, autoSaving resets to false", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { result, rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.lastSaved).toBeInstanceOf(Date);
    expect(result.current.autoSaving).toBe(false);
  });

  it("onSave returns false → lastSaved stays null, autoSaving resets", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    let formValues = { name: "initial" };
    const { result, rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.lastSaved).toBeNull();
    expect(result.current.autoSaving).toBe(false);
  });

  it("multiple rapid changes → onSave only called once (debounce coalesces)", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "change1" };
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    formValues = { name: "change2" };
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    formValues = { name: "change3" };
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ name: "change3" });
  });

  it("open=false → value change does NOT trigger save", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { rerender } = renderHook(() =>
      useAutoSaveForm({
        open: false,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("resetTracking clears lastSaved", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { result, rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "changed" };
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.lastSaved).toBeInstanceOf(Date);

    act(() => {
      result.current.resetTracking();
    });

    expect(result.current.lastSaved).toBeNull();
  });

  it("flushAndGetPending returns pending values and cancels timer", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    let formValues = { name: "initial" };
    const { result, rerender } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues,
        onSave,
      }),
    );

    formValues = { name: "pending" };
    rerender();

    let pending: ReturnType<typeof result.current.flushAndGetPending>;
    act(() => {
      pending = result.current.flushAndGetPending();
    });

    expect(pending).toEqual({ name: "pending" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("flushAndGetPending returns null when no pending change", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useAutoSaveForm({
        open: true,
        formValues: { name: "initial" },
        onSave,
      }),
    );

    let pending: ReturnType<typeof result.current.flushAndGetPending>;
    act(() => {
      pending = result.current.flushAndGetPending();
    });

    expect(pending).toBeNull();
  });
});
