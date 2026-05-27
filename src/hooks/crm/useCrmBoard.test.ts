import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCrmBoard } from "./useCrmBoard";
import { useCrmCardDetails } from "./useCrmCardDetails";

// ── Mock ──────────────────────────────────────────────────────────────────────
//
// Per-table queue of results: each terminal await on a table's chain shifts the
// next queued result. This lets us simulate paginated fetches (fetchAllCardTags
// loops .range() until a page returns < 1000 rows).

const { mockFrom, queueTableResult, setTableResult, clearResults } = vi.hoisted(() => {
  const queues = new Map<string, { data: unknown; error: unknown }[]>();

  function nextResult(table: string): { data: unknown; error: unknown } {
    const q = queues.get(table);
    if (!q || q.length === 0) return { data: null, error: null };
    return q.length === 1 ? q[0] : q.shift()!;
  }

  function makeChain(table: string): any {
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            const p = Promise.resolve(nextResult(table));
            return p.then.bind(p);
          }
          if (prop === "catch" || prop === "finally") {
            const p = Promise.resolve(nextResult(table));
            return (p as any)[prop].bind(p);
          }
          return vi.fn().mockReturnValue(makeChain(table));
        },
      },
    );
  }

  const mockFrom = vi.fn((table: string) => makeChain(table));

  const setTableResult = (table: string, result: { data: unknown; error: unknown }) => {
    queues.set(table, [result]);
  };
  const queueTableResult = (table: string, results: { data: unknown; error: unknown }[]) => {
    queues.set(table, [...results]);
  };
  const clearResults = () => queues.clear();

  return { mockFrom, queueTableResult, setTableResult, clearResults };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearResults();
});

// ── useCrmBoard ───────────────────────────────────────────────────────────────

describe("useCrmBoard", () => {
  it("fetches columns, cards, tags and returns mapped board", async () => {
    setTableResult("crm_columns", {
      data: [{ id: "col1", title: "À faire", position: 0, is_archived: false }],
      error: null,
    });
    setTableResult("crm_cards", {
      data: [{ id: "card1", column_id: "col1", title: "Opportunité X", position: 0 }],
      error: null,
    });
    setTableResult("crm_tags", {
      data: [{ id: "tag1", name: "Chaud", category: "priorité", color: "#f00" }],
      error: null,
    });
    setTableResult("crm_card_tags", { data: [], error: null });

    const { result } = renderHook(() => useCrmBoard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("crm_columns");
    expect(mockFrom).toHaveBeenCalledWith("crm_cards");
    expect(mockFrom).toHaveBeenCalledWith("crm_tags");
    expect(mockFrom).toHaveBeenCalledWith("crm_card_tags");
    expect(result.current.data!.columns).toHaveLength(1);
    expect(result.current.data!.cards).toHaveLength(1);
    expect(result.current.data!.tags).toHaveLength(1);
  });

  it("paginates crm_card_tags until a page returns fewer than 1000 rows", async () => {
    setTableResult("crm_columns", { data: [], error: null });
    setTableResult("crm_cards", { data: [], error: null });
    setTableResult("crm_tags", { data: [], error: null });
    // First page: exactly 1000 rows → must fetch again. Second page: 1 row → stop.
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `ct${i}`, card_id: "card1", tag_id: "tag1" }));
    const lastPage = [{ id: "ct1000", card_id: "card1", tag_id: "tag1" }];
    queueTableResult("crm_card_tags", [
      { data: fullPage, error: null },
      { data: lastPage, error: null },
    ]);

    const { result } = renderHook(() => useCrmBoard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // crm_card_tags queried twice (page 1 full → page 2 partial)
    const cardTagCalls = mockFrom.mock.calls.filter((c) => c[0] === "crm_card_tags");
    expect(cardTagCalls).toHaveLength(2);
  });

  it("stops after one page when fewer than 1000 card_tags", async () => {
    setTableResult("crm_columns", { data: [], error: null });
    setTableResult("crm_cards", { data: [], error: null });
    setTableResult("crm_tags", { data: [], error: null });
    setTableResult("crm_card_tags", { data: [{ id: "ct1", card_id: "c1", tag_id: "t1" }], error: null });

    const { result } = renderHook(() => useCrmBoard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cardTagCalls = mockFrom.mock.calls.filter((c) => c[0] === "crm_card_tags");
    expect(cardTagCalls).toHaveLength(1);
  });

  it("propagates an error from the columns query", async () => {
    vi.useFakeTimers();
    setTableResult("crm_columns", { data: null, error: { message: "RLS denied" } });
    setTableResult("crm_cards", { data: [], error: null });
    setTableResult("crm_tags", { data: [], error: null });
    setTableResult("crm_card_tags", { data: [], error: null });

    const { result } = renderHook(() => useCrmBoard(), { wrapper });
    // useCrmBoard hardcodes retry:3 with exponential backoff — fast-forward through it.
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toMatchObject({ message: "RLS denied" });
    vi.useRealTimers();
  });

  it("propagates an error from the card_tags pagination", async () => {
    vi.useFakeTimers();
    setTableResult("crm_columns", { data: [], error: null });
    setTableResult("crm_cards", { data: [], error: null });
    setTableResult("crm_tags", { data: [], error: null });
    setTableResult("crm_card_tags", { data: null, error: { message: "tags fetch failed" } });

    const { result } = renderHook(() => useCrmBoard(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(result.current.isError).toBe(true);
    vi.useRealTimers();
  });
});

// ── useCrmCardDetails ─────────────────────────────────────────────────────────

describe("useCrmCardDetails", () => {
  it("is disabled when cardId is null", () => {
    const { result } = renderHook(() => useCrmCardDetails(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("fetches attachments, comments, activity and emails", async () => {
    setTableResult("crm_attachments", { data: [{ id: "a1", card_id: "card1", file_name: "doc.pdf" }], error: null });
    setTableResult("crm_comments", { data: [{ id: "cm1", card_id: "card1", content: "Note", is_deleted: false }], error: null });
    setTableResult("crm_activity_log", { data: [{ id: "act1", card_id: "card1", action: "created" }], error: null });
    setTableResult("crm_card_emails", { data: [{ id: "e1", card_id: "card1", subject: "Devis" }], error: null });

    const { result } = renderHook(() => useCrmCardDetails("card1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("crm_attachments");
    expect(mockFrom).toHaveBeenCalledWith("crm_comments");
    expect(mockFrom).toHaveBeenCalledWith("crm_activity_log");
    expect(mockFrom).toHaveBeenCalledWith("crm_card_emails");
    expect(result.current.data!.attachments).toHaveLength(1);
    expect(result.current.data!.comments).toHaveLength(1);
    expect(result.current.data!.activity).toHaveLength(1);
    expect(result.current.data!.emails).toHaveLength(1);
  });

  it("returns empty arrays when all detail queries are empty", async () => {
    setTableResult("crm_attachments", { data: [], error: null });
    setTableResult("crm_comments", { data: [], error: null });
    setTableResult("crm_activity_log", { data: [], error: null });
    setTableResult("crm_card_emails", { data: [], error: null });

    const { result } = renderHook(() => useCrmCardDetails("card1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ attachments: [], comments: [], activity: [], emails: [] });
  });
});
