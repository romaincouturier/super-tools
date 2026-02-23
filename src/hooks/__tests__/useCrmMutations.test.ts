import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateColumn,
  useUpdateColumn,
  useArchiveColumn,
  useDeleteCard,
  useCreateTag,
  useDeleteTag,
  useDeleteComment,
  useSendEmail,
  useExtractOpportunity,
} from "../mutations/useCrmMutations";

const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockGetSession = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}));

vi.mock("@/data/crm", () => ({
  logCrmActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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

describe("useCreateColumn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a column with auto-calculated position", async () => {
    // First call: get max position
    const posChain = chainable([{ position: 2 }]);
    // Second call: insert
    const insertChain = chainable({ id: "col-new", name: "New", position: 3 });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? posChain : insertChain;
    });

    const { result } = renderHook(() => useCreateColumn(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ name: "New" });
    });

    expect(mockFrom).toHaveBeenCalledWith("crm_columns");
  });
});

describe("useUpdateColumn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates column by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useUpdateColumn(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: "col-1", name: "Renamed" });
    });

    expect(mockFrom).toHaveBeenCalledWith("crm_columns");
  });
});

describe("useArchiveColumn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets is_archived to true", async () => {
    const chain = chainable(null, null);
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useArchiveColumn(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("col-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("crm_columns");
    expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith({
      is_archived: true,
    });
  });
});

describe("useDeleteCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes card by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteCard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("card-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("crm_cards");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "not found" }));

    const { result } = renderHook(() => useDeleteCard(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync("card-bad");
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a tag with defaults", async () => {
    const tag = { id: "tag-1", name: "VIP", color: "#3b82f6", category: null };
    mockFrom.mockReturnValue(chainable(tag));

    const { result } = renderHook(() => useCreateTag(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync({ name: "VIP" });
      expect(data).toEqual(tag);
    });
  });
});

describe("useDeleteTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes tag by id", async () => {
    mockFrom.mockReturnValue(chainable(null, null));

    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("tag-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("crm_tags");
  });
});

describe("useDeleteComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes a comment", async () => {
    const chain = chainable(null, null);
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useDeleteComment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("com-1");
    });

    expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith({
      is_deleted: true,
    });
  });
});

describe("useSendEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes crm-send-email function", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const { result } = renderHook(() => useSendEmail(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        input: {
          card_id: "card-1",
          recipient_email: "to@test.com",
          subject: "Hello",
          body_html: "<p>Hi</p>",
        },
        senderEmail: "from@test.com",
      });
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("crm-send-email", {
      body: expect.objectContaining({
        card_id: "card-1",
        recipient_email: "to@test.com",
      }),
    });
  });

  it("throws when function returns error", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "smtp error" } });

    const { result } = renderHook(() => useSendEmail(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          input: { card_id: "c", recipient_email: "t", subject: "s", body_html: "b" },
          senderEmail: "f",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("throws when data.success is false", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: false, message: "Recipient not found" },
      error: null,
    });

    const { result } = renderHook(() => useSendEmail(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          input: { card_id: "c", recipient_email: "bad", subject: "s", body_html: "b" },
          senderEmail: "f",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useExtractOpportunity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when not authenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useExtractOpportunity(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync("Du texte brut");
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Non authentifié");
  });

  it("invokes crm-extract-opportunity when authenticated", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
    const extraction = { title: "Formation React", company: "Acme" };
    mockFunctionsInvoke.mockResolvedValue({ data: extraction, error: null });

    const { result } = renderHook(() => useExtractOpportunity(), { wrapper: createWrapper() });

    await act(async () => {
      const data = await result.current.mutateAsync("Formation React pour Acme Corp");
      expect(data).toEqual(extraction);
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("crm-extract-opportunity", {
      body: { raw_input: "Formation React pour Acme Corp" },
    });
  });
});
