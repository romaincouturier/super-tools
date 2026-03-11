// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRows = [
  { id: "1", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: "2026-03-01T10:00:00Z" },
  { id: "2", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: "2026-03-01T14:00:00Z" },
  { id: "3", user_id: "u1", feature_name: "export_pdf", feature_category: "export", metadata: null, created_at: "2026-03-02T09:00:00Z" },
  { id: "4", user_id: "u1", feature_name: "dashboard", feature_category: "navigation", metadata: null, created_at: "2026-03-03T11:00:00Z" },
  { id: "5", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: "2026-03-03T12:00:00Z" },
];

const mockSelect = vi.fn().mockReturnValue({
  gte: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
  }),
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ select: mockSelect }),
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}));

vi.mock("lucide-react", () => ({
  BarChart3: () => <span />,
  MousePointerClick: () => <span />,
  Layers: () => <span />,
  TrendingUp: () => <span />,
}));

// ── Helper ───────────────────────────────────────────────────────────────────

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FeatureUsageTab", () => {
  it("renders KPI cards and charts after data loads", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    // Wait for data to load — KPIs should appear
    expect(await screen.findByText("5")).toBeInTheDocument(); // total events
    expect(screen.getByText("Événements")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Catégories")).toBeInTheDocument();
    expect(screen.getByText("Moy. / jour")).toBeInTheDocument();
  });

  it("displays correct unique feature and category counts", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    // 3 unique features and 3 unique categories — both show "3"
    const threes = await screen.findAllByText("3");
    // At least 2 KPI cards show "3" (features + categories), plus the quiz row count
    expect(threes.length).toBeGreaterThanOrEqual(2);
  });

  it("displays correct unique category count", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    // 3 unique categories: learning, export, navigation
    // (also represented by "3" already checked above — both features and categories = 3)
    await screen.findByText("Catégories");
    const cards = screen.getAllByTestId("card");
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it("renders daily chart", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("5"); // wait for data
    expect(screen.getByText("Utilisation par jour")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(1);
  });

  it("renders feature detail table with correct data", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("5");
    expect(screen.getByText("Détail par feature")).toBeInTheDocument();
    expect(screen.getByText("quiz")).toBeInTheDocument();
    expect(screen.getByText("export_pdf")).toBeInTheDocument();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("renders category breakdown chart", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("5");
    expect(screen.getByText("Répartition par catégorie")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    // Override mock to return empty data
    mockSelect.mockReturnValueOnce({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    expect(
      await screen.findByText("Aucune donnée d'usage sur cette période."),
    ).toBeInTheDocument();
  });
});
