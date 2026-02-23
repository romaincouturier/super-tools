import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateMission,
  useUpdateMission,
  useDeleteMission,
  useMoveMission,
  useCreateMissionActivity,
  useDeleteMissionActivity,
  useCreateMissionPage,
  useCreateMissionContact,
} from "../mutations/useMissionMutations";

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
    "or",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "insert",
    "update",
    "delete",
    "upsert",
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCreateMission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a mission with auto-calculated position", async () => {
    const posChain = chainable([{ position: 5 }]);
    const insertChain = chainable({ id: "m-new", title: "New", position: 6 });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? posChain : insertChain;
    });

    const { result } = renderHook(() => useCreateMission(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ title: "New" } as never);
      expect(data).toEqual(expect.objectContaining({ id: "m-new" }));
    });
  });
});

describe("useUpdateMission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates mission by id", async () => {
    const updated = { id: "m-1", title: "Updated" };
    mockFrom.mockReturnValue(chainable(updated));

    const { result } = renderHook(() => useUpdateMission(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        id: "m-1",
        updates: { title: "Updated" },
      });
      expect(data).toEqual(updated);
    });
  });
});

describe("useDeleteMission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes mission by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteMission(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("m-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("missions");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "not found" }));

    const { result } = renderHook(() => useDeleteMission(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync("m-bad");
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useMoveMission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves mission to new status and position", async () => {
    const chain = chainable(null, null);
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useMoveMission(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        missionId: "m-1",
        newStatus: "in_progress" as never,
        newPosition: 0,
      });
    });

    expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith({
      status: "in_progress",
      position: 0,
    });
  });
});

describe("useCreateMissionActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an activity", async () => {
    const activity = { id: "a-1", mission_id: "m-1", description: "Meeting" };
    mockFrom.mockReturnValue(chainable(activity));

    const { result } = renderHook(() => useCreateMissionActivity(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        mission_id: "m-1",
        description: "Meeting",
        activity_date: "2024-03-01",
        duration_type: "hours",
        duration: 2,
        billable_amount: null,
        invoice_url: null,
        invoice_number: null,
        is_billed: false,
        notes: null,
      });
      expect(data).toEqual(activity);
    });
  });
});

describe("useDeleteMissionActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes activity and returns missionId", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteMissionActivity(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ id: "a-1", missionId: "m-1" });
      expect(data).toEqual({ missionId: "m-1" });
    });
  });
});

describe("useCreateMissionPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates page with auto-calculated position and default title", async () => {
    const posChain = chainable([{ position: 3 }]);
    const insertChain = chainable({
      id: "pg-1",
      mission_id: "m-1",
      title: "Sans titre",
      position: 4,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? posChain : insertChain;
    });

    const { result } = renderHook(() => useCreateMissionPage(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ mission_id: "m-1" });
      expect(data).toEqual(expect.objectContaining({ title: "Sans titre" }));
    });
  });
});

describe("useCreateMissionContact", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a contact and clears other primary if is_primary", async () => {
    // First call: get max position
    const posChain = chainable([{ position: 0 }]);
    // Second call: clear other primaries
    const updateChain = chainable(null, null);
    // Third call: insert
    const insertChain = chainable({
      id: "c-1",
      mission_id: "m-1",
      first_name: "Alice",
      is_primary: true,
      position: 1,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return posChain;
      if (callCount === 2) return updateChain;
      return insertChain;
    });

    const { result } = renderHook(() => useCreateMissionContact(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        mission_id: "m-1",
        first_name: "Alice",
        is_primary: true,
      });
      expect(data).toEqual(expect.objectContaining({ first_name: "Alice", is_primary: true }));
    });
  });
});
