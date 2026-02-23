import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCrmReports, useCrmSettings } from "../queries/useCrmQueries";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Also mock data/crm for useCrmBoard (not tested here since it delegates)
vi.mock("@/data/crm", () => ({
  fetchBoardData: vi.fn(),
  fetchCardDetails: vi.fn(),
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

describe("useCrmReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes report data from columns, cards, tags, and cardTags", async () => {
    const columns = [
      { id: "col-1", name: "Prospects", position: 0, is_archived: false },
      { id: "col-2", name: "Négociation", position: 1, is_archived: false },
    ];
    const cards = [
      { id: "card-1", column_id: "col-1", sales_status: "WON", estimated_value: 5000 },
      { id: "card-2", column_id: "col-1", sales_status: "OPEN", estimated_value: 3000 },
      { id: "card-3", column_id: "col-2", sales_status: "LOST", estimated_value: 2000 },
      { id: "card-4", column_id: "col-2", sales_status: "WON", estimated_value: 7000 },
    ];
    const tags = [
      { id: "tag-1", name: "Formation", color: "#000", category: "service" },
      { id: "tag-2", name: "Mission", color: "#111", category: "service" },
    ];
    const cardTags = [
      { card_id: "card-1", tag_id: "tag-1" },
      { card_id: "card-2", tag_id: "tag-1" },
      { card_id: "card-4", tag_id: "tag-2" },
    ];

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "crm_columns":
          return chainable(columns);
        case "crm_cards":
          return chainable(cards);
        case "crm_tags":
          return chainable(tags);
        case "crm_card_tags":
          return chainable(cardTags);
        default:
          return chainable();
      }
    });

    const { result } = renderHook(() => useCrmReports(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.totalCards).toBe(4);
    expect(data.wonCount).toBe(2);
    expect(data.wonValue).toBe(12000);
    expect(data.lostCount).toBe(1);
    expect(data.openCount).toBe(1);
    expect(data.openValue).toBe(3000);

    expect(data.cardsPerColumn).toEqual([
      { columnName: "Prospects", count: 2 },
      { columnName: "Négociation", count: 2 },
    ]);

    expect(data.breakdownByCategory).toHaveLength(1);
    expect(data.breakdownByCategory[0].category).toBe("service");
    expect(data.breakdownByCategory[0].count).toBe(3);
    expect(data.breakdownByCategory[0].value).toBe(15000);
  });

  it("handles empty data", async () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useCrmReports(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.totalCards).toBe(0);
    expect(data.wonCount).toBe(0);
    expect(data.breakdownByCategory).toEqual([]);
  });
});

describe("useCrmSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns service type colors from database", async () => {
    const customColors = { formation: "#111", mission: "#222", default: "#333" };
    const settingsData = [{ setting_key: "service_type_colors", setting_value: customColors }];
    mockFrom.mockReturnValue(chainable(settingsData));

    const { result } = renderHook(() => useCrmSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.serviceTypeColors).toEqual(customColors);
  });

  it("returns default colors when no settings found", async () => {
    mockFrom.mockReturnValue(chainable([]));

    const { result } = renderHook(() => useCrmSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.serviceTypeColors).toEqual({
      formation: "#3b82f6",
      mission: "#8b5cf6",
      default: "#6b7280",
    });
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable(null, { message: "access denied" }));

    const { result } = renderHook(() => useCrmSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
