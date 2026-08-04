// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────────────────

// Dates relatives : le graphe journalier ne couvre que la période sélectionnée,
// des dates figées tomberaient hors fenêtre et rendraient les tests muets.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

const mockRows = [
  { id: "1", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: daysAgo(3) },
  { id: "2", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: daysAgo(3) },
  { id: "3", user_id: "u1", feature_name: "export_pdf", feature_category: "export", metadata: null, created_at: daysAgo(2) },
  { id: "4", user_id: "u1", feature_name: "dashboard", feature_category: "navigation", metadata: null, created_at: daysAgo(1) },
  { id: "5", user_id: "u1", feature_name: "quiz", feature_category: "learning", metadata: null, created_at: daysAgo(1) },
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

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToggleGroupItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-value={value}>{children}</button>
  ),
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
}));

vi.mock("lucide-react", () => ({
  BarChart3: () => <span />,
  CalendarCheck: () => <span />,
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
  it("renders KPI cards after data loads", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    // Portée par défaut = actions métier : les 4 événements hors navigation.
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("Événements")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Jours actifs")).toBeInTheDocument();
    expect(screen.getByText("Moy. / jour actif")).toBeInTheDocument();
  });

  it("excludes page views from the default scope", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("4");
    // `dashboard` est en catégorie navigation : absent du détail par feature.
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("quiz")).toBeInTheDocument();
    expect(screen.getByText("export_pdf")).toBeInTheDocument();
    // Le graphe par catégorie reste sur l'ensemble : navigation y figure.
    expect(screen.getByText("Répartition par catégorie")).toBeInTheDocument();
  });

  it("counts active days over the selected window", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("4");
    // 3 jours distincts portent des événements, dont 2 hors navigation.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("/ 30")).toBeInTheDocument();
  });

  it("renders the daily chart with a trend line", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("4");
    expect(screen.getByText("Utilisation par jour")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("renders feature detail table with correct data", async () => {
    const { default: FeatureUsageTab } = await import("./FeatureUsageTab");
    renderWithQuery(<FeatureUsageTab />);

    await screen.findByText("4");
    expect(screen.getByText("Détail par feature")).toBeInTheDocument();
    expect(screen.getByText("quiz")).toBeInTheDocument();
    expect(screen.getByText("export_pdf")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
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
