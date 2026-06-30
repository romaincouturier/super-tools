import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useLearnerWorkDeposits,
  usePracticeDeposits,
  useLearnerReceivedFeedback,
  useCoursePageViews,
} from "./useLearnerPortalData";

// ── Supabase mock ─────────────────────────────────────────────────────────────
//
// Each hook uses a fluent chain: supabase.from(...).select(...).eq(...).limit(...)
// We mock `from` to return a "thenable chain": every method returns the same
// object, and the object itself is awaitable (implements .then/.catch).
// This means `await supabase.from(...).select(...).eq(...).limit(...)` resolves
// to whatever `mockResolve` was set to.

const { mockFrom, setNextResult } = vi.hoisted(() => {
  let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

  function makeChain(): any {
    const p = Promise.resolve(nextResult);
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          if (prop === "finally") return p.finally.bind(p);
          // Spy so tests can assert which methods were called
          return vi.fn().mockReturnValue(makeChain());
        },
      },
    );
  }

  const mockFrom = vi.fn(() => makeChain());
  const setNextResult = (result: { data: unknown; error: unknown }) => {
    nextResult = result;
  };
  return { mockFrom, setNextResult };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
  createLearnerClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  setNextResult({ data: null, error: null });
});

// ── useLearnerWorkDeposits ────────────────────────────────────────────────────

describe("useLearnerWorkDeposits", () => {
  it("is disabled when email is null — supabase is never called", () => {
    const { result } = renderHook(() => useLearnerWorkDeposits(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries lms_work_deposits and returns results", async () => {
    const deposits = [{ id: "a", file_name: "photo.jpg" }];
    setNextResult({ data: deposits, error: null });

    const { result } = renderHook(() => useLearnerWorkDeposits("user@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("lms_work_deposits");
    expect(result.current.data).toEqual(deposits);
  });

  it("returns empty array when supabase gives null data", async () => {
    setNextResult({ data: null, error: null });
    const { result } = renderHook(() => useLearnerWorkDeposits("user@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propagates the error when supabase returns one", async () => {
    setNextResult({ data: null, error: { message: "RLS denied" } });
    const { result } = renderHook(() => useLearnerWorkDeposits("user@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "RLS denied" });
  });
});

// ── usePracticeDeposits ───────────────────────────────────────────────────────

describe("usePracticeDeposits", () => {
  it("is disabled when courseIds is empty", () => {
    const { result } = renderHook(() => usePracticeDeposits([]), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries lms_work_deposits and returns enriched results", async () => {
    const deposits = [{ id: "x", publication_status: "published" }];
    setNextResult({ data: deposits, error: null });

    const { result } = renderHook(() => usePracticeDeposits(["course-1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("lms_work_deposits");
    // Hook enriches each deposit with reaction/comment counts and titles
    expect(result.current.data).toEqual([
      expect.objectContaining({ id: "x", publication_status: "published", reaction_count: 0, i_reacted: false, comment_count: 0 }),
    ]);
  });

  it("returns empty array when queryFn receives null data", async () => {
    setNextResult({ data: null, error: null });
    const { result } = renderHook(() => usePracticeDeposits(["course-1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// ── useLearnerReceivedFeedback ────────────────────────────────────────────────

describe("useLearnerReceivedFeedback", () => {
  it("is disabled when email is null", () => {
    const { result } = renderHook(() => useLearnerReceivedFeedback(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns an empty array when the learner has no deposits", async () => {
    setNextResult({ data: [], error: null });

    const { result } = renderHook(
      () => useLearnerReceivedFeedback("alice@example.com"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("lms_work_deposits");
    expect(result.current.data).toEqual([]);
  });

  it("propagates supabase errors", async () => {
    setNextResult({ data: null, error: { message: "timeout" } });
    const { result } = renderHook(
      () => useLearnerReceivedFeedback("a@b.com"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useCoursePageViews ────────────────────────────────────────────────────────

describe("useCoursePageViews", () => {
  it("is disabled when courseId is null", () => {
    const { result } = renderHook(() => useCoursePageViews(null, "a@b.com"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when email is null", () => {
    const { result } = renderHook(() => useCoursePageViews("course-1", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("maps rows to an array of lesson IDs", async () => {
    setNextResult({ data: [{ lesson_id: "l1" }, { lesson_id: "l2" }], error: null });

    const { result } = renderHook(
      () => useCoursePageViews("course-1", "user@test.com"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("lms_page_views");
    expect(result.current.data).toEqual(["l1", "l2"]);
  });

  it("returns empty array when supabase gives null data", async () => {
    setNextResult({ data: null, error: null });
    const { result } = renderHook(
      () => useCoursePageViews("course-1", "user@test.com"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propagates supabase errors", async () => {
    setNextResult({ data: null, error: { message: "network error" } });
    const { result } = renderHook(
      () => useCoursePageViews("course-1", "user@test.com"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
