import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useOKRObjectives,
  useOKRObjective,
  useOKRFavorites,
  useOKRKeyResults,
  useOKRStatistics,
} from "../queries/useOKRQueries";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "is",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "insert",
    "update",
    "delete",
    "filter",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useOKRObjectives", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns objectives list", async () => {
    const objectives = [
      { id: "obj-1", title: "Grow Revenue", status: "active", position: 0 },
      { id: "obj-2", title: "Improve Quality", status: "completed", position: 1 },
    ];
    mockFrom.mockReturnValue(chainable(objectives));

    const { result } = renderHook(() => useOKRObjectives(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("returns empty array when no data", async () => {
    mockFrom.mockReturnValue(chainable(null));

    const { result } = renderHook(() => useOKRObjectives(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useOKRObjective", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when objectiveId is null", () => {
    mockFrom.mockReturnValue(chainable(null));

    const { result } = renderHook(() => useOKRObjective(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches a single objective by id", async () => {
    const objective = { id: "obj-1", title: "Revenue", status: "active" };
    mockFrom.mockReturnValue(chainable(objective));

    const { result } = renderHook(() => useOKRObjective("obj-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(objective);
  });
});

describe("useOKRFavorites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns favorites with key results", async () => {
    const favorites = [
      {
        id: "obj-1",
        title: "Revenue",
        is_favorite: true,
        favorite_position: 0,
        okr_key_results: [
          { id: "kr-1", title: "KR 1", progress_percentage: 50, confidence_level: 80 },
        ],
      },
    ];
    mockFrom.mockReturnValue(chainable(favorites));

    const { result } = renderHook(() => useOKRFavorites(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].okr_key_results).toHaveLength(1);
  });
});

describe("useOKRKeyResults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when objectiveId is null", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useOKRKeyResults(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns key results for an objective", async () => {
    const keyResults = [
      { id: "kr-1", objective_id: "obj-1", title: "KR 1", progress_percentage: 60 },
    ];
    mockFrom.mockReturnValue(chainable(keyResults));

    const { result } = renderHook(() => useOKRKeyResults("obj-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useOKRStatistics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("computes statistics from objectives", async () => {
    const objectives = [
      {
        id: "1",
        status: "active",
        progress_percentage: 40,
        confidence_level: 70,
        time_target: "Q1",
      },
      {
        id: "2",
        status: "active",
        progress_percentage: 60,
        confidence_level: 90,
        time_target: "Q1",
      },
      {
        id: "3",
        status: "completed",
        progress_percentage: 100,
        confidence_level: 100,
        time_target: "Q2",
      },
    ];
    mockFrom.mockReturnValue(chainable(objectives));

    const { result } = renderHook(() => useOKRStatistics(2024), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data!;
    expect(stats.totalObjectives).toBe(3);
    expect(stats.activeObjectives).toBe(2);
    expect(stats.completedObjectives).toBe(1);
    expect(stats.avgProgress).toBe(67); // Math.round((40+60+100)/3)
    expect(stats.avgConfidence).toBe(87); // Math.round((70+90+100)/3)
    expect(stats.byQuarter.Q1).toEqual({ count: 2, avgProgress: 50 });
    expect(stats.byQuarter.Q2).toEqual({ count: 1, avgProgress: 100 });
  });

  it("returns zeros when no objectives", async () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useOKRStatistics(2024), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data!;
    expect(stats.totalObjectives).toBe(0);
    expect(stats.avgProgress).toBe(0);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.byQuarter).toEqual({});
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "error" }));

    const { result } = renderHook(() => useOKRStatistics(2024), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
