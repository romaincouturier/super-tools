import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useMissions,
  useSearchMissions,
  useMissionActivities,
  useMissionPages,
  useMissionPageTemplates,
  useMissionContacts,
} from "../queries/useMissionQueries";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "or", "order", "limit", "single", "maybeSingle"];
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

describe("useMissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns missions ordered by position", async () => {
    const missions = [
      { id: "m-1", title: "Mission A", status: "in_progress", position: 0 },
      { id: "m-2", title: "Mission B", status: "completed", position: 1 },
    ];
    mockFrom.mockReturnValue(chainable(missions));

    const { result } = renderHook(() => useMissions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("returns empty array when no missions", async () => {
    mockFrom.mockReturnValue(chainable(null));

    const { result } = renderHook(() => useMissions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "error" }));

    const { result } = renderHook(() => useMissions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useSearchMissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when searchTerm is less than 2 chars", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useSearchMissions("a"), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("searches missions when searchTerm is 2+ chars", async () => {
    const missions = [
      { id: "m-1", title: "React Formation", client_name: "Acme", status: "in_progress" },
    ];
    mockFrom.mockReturnValue(chainable(missions));

    const { result } = renderHook(() => useSearchMissions("React"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useMissionActivities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when missionId is null", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useMissionActivities(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns activities for a mission", async () => {
    const activities = [
      { id: "a-1", mission_id: "m-1", description: "Meeting", activity_date: "2024-03-01" },
    ];
    mockFrom.mockReturnValue(chainable(activities));

    const { result } = renderHook(() => useMissionActivities("m-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useMissionPages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when missionId is null", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useMissionPages(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns pages for a mission", async () => {
    const pages = [{ id: "pg-1", mission_id: "m-1", title: "Notes", position: 0 }];
    mockFrom.mockReturnValue(chainable(pages));

    const { result } = renderHook(() => useMissionPages("m-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useMissionPageTemplates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns templates ordered by position", async () => {
    const templates = [{ id: "t-1", name: "Meeting Notes", content: "# Meeting\n", position: 0 }];
    mockFrom.mockReturnValue(chainable(templates));

    const { result } = renderHook(() => useMissionPageTemplates(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useMissionContacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when missionId is null", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useMissionContacts(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns contacts for a mission", async () => {
    const contacts = [
      { id: "c-1", mission_id: "m-1", first_name: "Alice", is_primary: true, position: 0 },
    ];
    mockFrom.mockReturnValue(chainable(contacts));

    const { result } = renderHook(() => useMissionContacts("m-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
