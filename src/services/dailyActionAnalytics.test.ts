import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ───────────────────────────────────────────────────────────
const mockOrder = vi.fn();
const mockGte = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: vi.fn(() => ({ eq: mockEq })),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const { fetchDailyAnalytics } = await import("./dailyActionAnalytics");

beforeEach(() => {
  vi.clearAllMocks();
  // Default chain: select -> eq -> gte -> order -> { data, error }
  mockOrder.mockReturnValue({ data: [], error: null });
  mockGte.mockReturnValue({ order: mockOrder });
  mockEq.mockReturnValue({ gte: mockGte });
  mockSelect.mockReturnValue({ eq: mockEq });
});

describe("fetchDailyAnalytics (aggregateAnalytics integration)", () => {
  it("returns null when no data", async () => {
    mockOrder.mockReturnValue({ data: [], error: null });
    const result = await fetchDailyAnalytics("user-1");
    expect(result).toBeNull();
  });

  it("returns null when data is null", async () => {
    mockOrder.mockReturnValue({ data: null, error: null });
    const result = await fetchDailyAnalytics("user-1");
    expect(result).toBeNull();
  });

  it("aggregates single day analytics correctly", async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          total_actions: 10,
          completed_count: 7,
          category_stats: {
            missions_actions: {
              label: "Missions",
              avg_completion_minutes: 30,
              total: 5,
              completed: 3,
            },
            devis_a_faire: {
              label: "Devis",
              avg_completion_minutes: 15,
              total: 5,
              completed: 4,
            },
          },
        },
      ],
      error: null,
    });

    const result = await fetchDailyAnalytics("user-1");
    expect(result).not.toBeNull();
    expect(result!.total_actions).toBe(10);
    expect(result!.completed_count).toBe(7);
    expect(result!.category_stats.missions_actions.total).toBe(5);
    expect(result!.category_stats.missions_actions.completed).toBe(3);
    expect(result!.category_stats.missions_actions.avg_completion_minutes).toBe(30);
  });

  it("aggregates multiple days, averaging completion minutes", async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          total_actions: 6,
          completed_count: 4,
          category_stats: {
            missions_actions: {
              label: "M",
              avg_completion_minutes: 20,
              total: 3,
              completed: 2,
            },
          },
        },
        {
          total_actions: 4,
          completed_count: 3,
          category_stats: {
            missions_actions: {
              label: "M",
              avg_completion_minutes: 40,
              total: 2,
              completed: 1,
            },
          },
        },
      ],
      error: null,
    });

    const result = await fetchDailyAnalytics("user-1");
    expect(result!.total_actions).toBe(10);
    expect(result!.completed_count).toBe(7);
    // missions_actions: (20 + 40) / 2 = 30
    expect(result!.category_stats.missions_actions.avg_completion_minutes).toBe(30);
    expect(result!.category_stats.missions_actions.total).toBe(5);
    expect(result!.category_stats.missions_actions.completed).toBe(3);
  });

  it("handles null avg_completion_minutes gracefully", async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          total_actions: 3,
          completed_count: 0,
          category_stats: {
            devis_a_faire: {
              label: "Devis",
              avg_completion_minutes: null,
              total: 3,
              completed: 0,
            },
          },
        },
      ],
      error: null,
    });

    const result = await fetchDailyAnalytics("user-1");
    expect(result!.category_stats.devis_a_faire.avg_completion_minutes).toBeNull();
  });

  it("handles day with null category_stats", async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          total_actions: 5,
          completed_count: 2,
          category_stats: null,
        },
      ],
      error: null,
    });

    const result = await fetchDailyAnalytics("user-1");
    expect(result!.total_actions).toBe(5);
    expect(result!.completed_count).toBe(2);
    expect(Object.keys(result!.category_stats)).toHaveLength(0);
  });

  it("uses label from CATEGORIES for known categories", async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          total_actions: 1,
          completed_count: 1,
          category_stats: {
            missions_actions: {
              label: "whatever",
              avg_completion_minutes: 5,
              total: 1,
              completed: 1,
            },
          },
        },
      ],
      error: null,
    });

    const result = await fetchDailyAnalytics("user-1");
    // Should use CATEGORIES label, not the one from the row
    expect(result!.category_stats.missions_actions.label).toContain("Missions");
  });
});
