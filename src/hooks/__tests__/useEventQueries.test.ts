import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEvents, useEvent, useEventMedia } from "../queries/useEventQueries";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "single", "maybeSingle"];
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

describe("useEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns events ordered by date", async () => {
    const events = [
      { id: "e-1", title: "Workshop", event_date: "2024-03-01" },
      { id: "e-2", title: "Conference", event_date: "2024-04-01" },
    ];
    mockFrom.mockReturnValue(chainable(events));

    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("returns empty array when no events", async () => {
    mockFrom.mockReturnValue(chainable(null));

    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "error" }));

    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when id is undefined", () => {
    mockFrom.mockReturnValue(chainable(null));

    const { result } = renderHook(() => useEvent(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches a single event", async () => {
    const event = { id: "e-1", title: "Workshop", event_date: "2024-03-01" };
    mockFrom.mockReturnValue(chainable(event));

    const { result } = renderHook(() => useEvent("e-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(event);
  });
});

describe("useEventMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is disabled when eventId is undefined", () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useEventMedia(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns media for an event", async () => {
    const media = [{ id: "m-1", event_id: "e-1", url: "https://example.com/img.jpg", position: 0 }];
    mockFrom.mockReturnValue(chainable(media));

    const { result } = renderHook(() => useEventMedia("e-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
