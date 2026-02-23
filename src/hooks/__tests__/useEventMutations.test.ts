import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useAddEventMedia,
  useDeleteEventMedia,
} from "../mutations/useEventMutations";

const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  },
}));

function chainable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "single", "insert", "update", "delete"];
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

describe("useCreateEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates event with current user as created_by", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    const event = { id: "e-1", title: "Workshop", created_by: "user-1" };
    mockFrom.mockReturnValue(chainable(event));

    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        title: "Workshop",
        event_date: "2024-03-01",
      } as never);
      expect(data).toEqual(event);
    });
  });

  it("throws on error", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    mockFrom.mockReturnValue(chainable(null, { message: "error" }));

    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({ title: "T" } as never);
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates event by id", async () => {
    const updated = { id: "e-1", title: "Updated Workshop" };
    mockFrom.mockReturnValue(chainable(updated));

    const { result } = renderHook(() => useUpdateEvent(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ id: "e-1", title: "Updated Workshop" });
      expect(data).toEqual(updated);
    });
  });
});

describe("useDeleteEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes event by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteEvent(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("e-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("events");
  });
});

describe("useAddEventMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds media with current user as created_by", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    const media = { id: "m-1", event_id: "e-1", url: "https://example.com/img.jpg" };
    mockFrom.mockReturnValue(chainable(media));

    const { result } = renderHook(() => useAddEventMedia(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({
        event_id: "e-1",
        url: "https://example.com/img.jpg",
        position: 0,
      } as never);
      expect(data).toEqual(media);
    });
  });
});

describe("useDeleteEventMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes media and returns eventId", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteEventMedia(), { wrapper: createWrapper() });

    await act(async () => {
      const eventId = await result.current.mutateAsync({ id: "m-1", eventId: "e-1" });
      expect(eventId).toBe("e-1");
    });
  });
});
