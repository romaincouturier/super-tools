import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useLessonTitle,
  useCourseTitle,
  usePracticePopularHashtags,
  usePracticeComments,
  useMyPracticeComments,
} from "./usePracticeFeed";

// ── Mock ──────────────────────────────────────────────────────────────────────

const { mockFrom, mockRpc, setTableResult, clearResults } = vi.hoisted(() => {
  const tableResults = new Map<string, { data: unknown; error: unknown }>();

  function makeChain(table?: string): any {
    const result = tableResults.get(table ?? "") ?? { data: null, error: null };
    const p = Promise.resolve(result);
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          if (prop === "finally") return p.finally.bind(p);
          return vi.fn().mockReturnValue(makeChain(table));
        },
      },
    );
  }

  const mockRpc = vi.fn((_name: string) => Promise.resolve({ data: null, error: null }));
  const mockFrom = vi.fn((table: string) => makeChain(table));
  const mockClient = { from: mockFrom, rpc: mockRpc };

  const setTableResult = (table: string, result: { data: unknown; error: unknown }) => {
    tableResults.set(table, result);
  };
  const clearResults = () => tableResults.clear();

  return { mockFrom, mockRpc, setTableResult, clearResults, mockClient };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
  createLearnerClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearResults();
});

// ── useLessonTitle ────────────────────────────────────────────────────────────

describe("useLessonTitle", () => {
  it("is disabled when lessonId is null", () => {
    const { result } = renderHook(() => useLessonTitle("a@b.com", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries lms_lessons and returns the title", async () => {
    setTableResult("lms_lessons", { data: { title: "Intro à la vente" }, error: null });
    const { result } = renderHook(() => useLessonTitle("a@b.com", "lesson-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith("lms_lessons");
    expect(result.current.data).toBe("Intro à la vente");
  });

  it("returns null when lesson row has no title", async () => {
    setTableResult("lms_lessons", { data: null, error: null });
    const { result } = renderHook(() => useLessonTitle("a@b.com", "lesson-x"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("works without a learner email (falls back to anon client)", async () => {
    setTableResult("lms_lessons", { data: { title: "Module 2" }, error: null });
    const { result } = renderHook(() => useLessonTitle(null, "lesson-2"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("Module 2");
  });
});

// ── useCourseTitle ────────────────────────────────────────────────────────────

describe("useCourseTitle", () => {
  it("is disabled when courseId is null", () => {
    const { result } = renderHook(() => useCourseTitle("a@b.com", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries lms_courses and returns the title", async () => {
    setTableResult("lms_courses", { data: { title: "Formation Excel" }, error: null });
    const { result } = renderHook(() => useCourseTitle("a@b.com", "course-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith("lms_courses");
    expect(result.current.data).toBe("Formation Excel");
  });

  it("returns null when course is not found", async () => {
    setTableResult("lms_courses", { data: null, error: null });
    const { result } = renderHook(() => useCourseTitle("a@b.com", "course-x"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

// ── usePracticePopularHashtags ────────────────────────────────────────────────

describe("usePracticePopularHashtags", () => {
  it("is disabled when learnerEmail is null", () => {
    const { result } = renderHook(() => usePracticePopularHashtags(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls practice_popular_hashtags RPC and maps results", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { tag: "vente", post_count: "12" },
        { tag: "prospection", post_count: "7" },
      ],
      error: null,
    });
    const { result } = renderHook(() => usePracticePopularHashtags("a@b.com", 5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith("practice_popular_hashtags", { p_limit: 5 });
    expect(result.current.data).toEqual([
      { tag: "vente", post_count: 12 },
      { tag: "prospection", post_count: 7 },
    ]);
  });

  it("returns empty array when RPC returns null data", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => usePracticePopularHashtags("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propagates RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => usePracticePopularHashtags("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("coerces post_count from string to number (Supabase RPC returns bigint as string)", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ tag: "excel", post_count: "999" }], error: null });
    const { result } = renderHook(() => usePracticePopularHashtags("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(typeof result.current.data![0].post_count).toBe("number");
    expect(result.current.data![0].post_count).toBe(999);
  });
});

// ── usePracticeComments ───────────────────────────────────────────────────────

describe("usePracticeComments", () => {
  it("is disabled when postId is null", () => {
    const { result } = renderHook(() => usePracticeComments(null, "a@b.com"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when learnerEmail is null", () => {
    const { result } = renderHook(() => usePracticeComments("post-1", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns comments merged with learner profiles", async () => {
    setTableResult("practice_post_comments", {
      data: [{ id: "c1", post_id: "p1", author_email: "alice@x.com", content: "Bravo!", created_at: "2026-01-01" }],
      error: null,
    });
    setTableResult("learner_profiles", {
      data: [{ email: "alice@x.com", first_name: "Alice", last_name: "Martin", photo_url: null }],
      error: null,
    });

    const { result } = renderHook(() => usePracticeComments("p1", "alice@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("practice_post_comments");
    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: "c1",
        content: "Bravo!",
        author_email: "alice@x.com",
        author_first_name: "Alice",
        author_last_name: "Martin",
        author_photo_url: null,
      }),
    ]);
  });

  it("returns comments with null profile fields when profile is not found", async () => {
    setTableResult("practice_post_comments", {
      data: [{ id: "c2", post_id: "p2", author_email: "unknown@x.com", content: "Hello", created_at: "2026-01-01" }],
      error: null,
    });
    setTableResult("learner_profiles", { data: [], error: null });

    const { result } = renderHook(() => usePracticeComments("p2", "viewer@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0].author_first_name).toBeNull();
    expect(result.current.data![0].author_last_name).toBeNull();
  });
});

// ── useMyPracticeComments ─────────────────────────────────────────────────────

describe("useMyPracticeComments", () => {
  it("is disabled when learnerEmail is null", () => {
    const { result } = renderHook(() => useMyPracticeComments(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty array when user has no comments", async () => {
    setTableResult("practice_post_comments", { data: [], error: null });
    const { result } = renderHook(() => useMyPracticeComments("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("maps comments with post context", async () => {
    setTableResult("practice_post_comments", {
      data: [{ id: "cm1", post_id: "p1", content: "Mon retour", created_at: "2026-01-01" }],
      error: null,
    });
    setTableResult("practice_posts", {
      data: [{ id: "p1", content: "Le post original", author_email: "bob@x.com" }],
      error: null,
    });

    const { result } = renderHook(() => useMyPracticeComments("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      {
        id: "cm1",
        post_id: "p1",
        content: "Mon retour",
        created_at: "2026-01-01",
        post_excerpt: "Le post original",
        post_author_email: "bob@x.com",
      },
    ]);
  });

  it("propagates errors", async () => {
    setTableResult("practice_post_comments", { data: null, error: { message: "network error" } });
    const { result } = renderHook(() => useMyPracticeComments("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
