import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEdgeFunction } from "./useEdgeFunction";

const { mockInvoke, mockToast, mockToastError } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockToast: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/lib/toastError", () => ({ toastError: (...args: unknown[]) => mockToastError(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEdgeFunction", () => {
  it("initial state: loading=false, result=null, error=null", () => {
    const { result } = renderHook(() => useEdgeFunction("my-fn"));
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets loading=true during call and resets to false after", async () => {
    let resolveInvoke!: (v: unknown) => void;
    mockInvoke.mockReturnValue(new Promise((res) => { resolveInvoke = res; }));

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    let invokePromise!: Promise<unknown>;
    act(() => {
      invokePromise = result.current.invoke();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveInvoke({ data: "val", error: null });
      await invokePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("successful response with raw data sets result, error stays null", async () => {
    mockInvoke.mockResolvedValue({ data: { name: "test" }, error: null });

    const { result } = renderHook(() => useEdgeFunction<{ name: string }>("my-fn"));

    await act(async () => {
      await result.current.invoke();
    });

    expect(result.current.result).toEqual({ name: "test" });
    expect(result.current.error).toBeNull();
  });

  it("extracts .result from { result: T } shaped response", async () => {
    mockInvoke.mockResolvedValue({ data: { result: { id: 42 } }, error: null });

    const { result } = renderHook(() => useEdgeFunction<{ id: number }>("my-fn"));

    await act(async () => {
      await result.current.invoke();
    });

    expect(result.current.result).toEqual({ id: 42 });
  });

  it("calls toast on success when successToast option is provided", async () => {
    mockInvoke.mockResolvedValue({ data: "ok", error: null });

    const { result } = renderHook(() =>
      useEdgeFunction("my-fn", { successToast: { title: "Done", description: "All good" } }),
    );

    await act(async () => {
      await result.current.invoke();
    });

    expect(mockToast).toHaveBeenCalledWith({ title: "Done", description: "All good" });
  });

  it("does NOT call toast on success when successToast is not provided", async () => {
    mockInvoke.mockResolvedValue({ data: "ok", error: null });

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    await act(async () => {
      await result.current.invoke();
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("sets error, returns null, calls toastError on response.error", async () => {
    const responseError = new Error("edge error");
    mockInvoke.mockResolvedValue({ data: null, error: responseError });

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.invoke();
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("edge error");
    expect(mockToastError).toHaveBeenCalled();
  });

  it("does NOT call toastError when silentOnError=true", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("silent") });

    const { result } = renderHook(() => useEdgeFunction("my-fn", { silentOnError: true }));

    await act(async () => {
      await result.current.invoke();
    });

    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("passes custom errorMessage to toastError", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("raw") });

    const { result } = renderHook(() =>
      useEdgeFunction("my-fn", { errorMessage: "Custom error msg" }),
    );

    await act(async () => {
      await result.current.invoke();
    });

    expect(mockToastError).toHaveBeenCalledWith(mockToast, "Custom error msg");
  });

  it("reset clears result and error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("oops") });

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    await act(async () => {
      await result.current.invoke();
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("passes body to supabase.functions.invoke", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    await act(async () => {
      await result.current.invoke({ key: "value" });
    });

    expect(mockInvoke).toHaveBeenCalledWith("my-fn", { body: { key: "value" } });
  });

  it("passes empty object when no body provided", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useEdgeFunction("my-fn"));

    await act(async () => {
      await result.current.invoke();
    });

    expect(mockInvoke).toHaveBeenCalledWith("my-fn", { body: {} });
  });
});
