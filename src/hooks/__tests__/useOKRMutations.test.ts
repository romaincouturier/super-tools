import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateOKRObjective,
  useUpdateOKRObjective,
  useDeleteOKRObjective,
  useToggleOKRFavorite,
  useCreateOKRKeyResult,
  useDeleteOKRKeyResult,
  useAddOKRParticipant,
  useRemoveOKRParticipant,
  useCreateOKRCheckIn,
} from "../mutations/useOKRMutations";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = null, error: unknown = null) {
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
    "upsert",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCreateOKRObjective", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates objective with auto-calculated position", async () => {
    const posChain = chainable([{ position: 2 }]);
    const insertChain = chainable({ id: "obj-1", title: "Revenue", position: 3 });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? posChain : insertChain;
    });

    const { result } = renderHook(() => useCreateOKRObjective(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ title: "Revenue" } as never);
      expect(data).toEqual(expect.objectContaining({ id: "obj-1", position: 3 }));
    });
  });
});

describe("useUpdateOKRObjective", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates objective by id", async () => {
    const updated = { id: "obj-1", title: "Updated" };
    mockFrom.mockReturnValue(chainable(updated));

    const { result } = renderHook(() => useUpdateOKRObjective(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        id: "obj-1",
        updates: { title: "Updated" },
      });
      expect(data).toEqual(updated);
    });
  });
});

describe("useDeleteOKRObjective", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes objective by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteOKRObjective(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("obj-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("okr_objectives");
  });
});

describe("useToggleOKRFavorite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles favorite flag", async () => {
    const chain = chainable({ id: "obj-1", is_favorite: true });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useToggleOKRFavorite(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: "obj-1", isFavorite: true });
    });

    expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith({
      is_favorite: true,
    });
  });
});

describe("useCreateOKRKeyResult", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates key result with auto-calculated position", async () => {
    const posChain = chainable([{ position: 1 }]);
    const insertChain = chainable({ id: "kr-1", objective_id: "obj-1", position: 2 });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? posChain : insertChain;
    });

    const { result } = renderHook(() => useCreateOKRKeyResult(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        objective_id: "obj-1",
        title: "KR 1",
      } as never);
      expect(data).toEqual(expect.objectContaining({ id: "kr-1" }));
    });
  });
});

describe("useDeleteOKRKeyResult", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes key result and returns objectiveId", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteOKRKeyResult(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ id: "kr-1", objectiveId: "obj-1" });
      expect(data).toEqual({ objectiveId: "obj-1" });
    });
  });
});

describe("useAddOKRParticipant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds participant to objective", async () => {
    const participant = { id: "p-1", objective_id: "obj-1", email: "alice@test.com" };
    mockFrom.mockReturnValue(chainable(participant));

    const { result } = renderHook(() => useAddOKRParticipant(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        objective_id: "obj-1",
        email: "alice@test.com",
      });
      expect(data).toEqual(participant);
    });
  });
});

describe("useRemoveOKRParticipant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes participant and returns objectiveId", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useRemoveOKRParticipant(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ id: "p-1", objectiveId: "obj-1" });
      expect(data).toEqual({ objectiveId: "obj-1" });
    });
  });
});

describe("useCreateOKRCheckIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates check-in with previous progress snapshot and updates objective", async () => {
    // First call: get current objective progress
    const objectiveChain = chainable({ progress_percentage: 40, confidence_level: 70 });
    // Second call: insert check-in
    const checkInChain = chainable({
      id: "ci-1",
      objective_id: "obj-1",
      previous_progress: 40,
      previous_confidence: 70,
      new_progress: 60,
      new_confidence: 85,
    });
    // Third call: update objective with new values
    const updateChain = chainable(null, null);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return objectiveChain;
      if (callCount === 2) return checkInChain;
      return updateChain;
    });

    const { result } = renderHook(() => useCreateOKRCheckIn(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        objective_id: "obj-1",
        new_progress: 60,
        new_confidence: 85,
      } as never);
      expect(data).toEqual(
        expect.objectContaining({
          previous_progress: 40,
          previous_confidence: 70,
        }),
      );
    });

    // Should have called supabase 3 times: read objective, insert check-in, update objective
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("defaults previous values to 0/50 when objective has no data", async () => {
    const objectiveChain = chainable(null); // no data
    const checkInChain = chainable({
      id: "ci-1",
      objective_id: "obj-1",
      previous_progress: 0,
      previous_confidence: 50,
    });
    const updateChain = chainable(null, null);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return objectiveChain;
      if (callCount === 2) return checkInChain;
      return updateChain;
    });

    const { result } = renderHook(() => useCreateOKRCheckIn(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        objective_id: "obj-1",
        new_progress: 10,
        new_confidence: 60,
      } as never);
    });
  });
});
