// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────────────────

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

function row(over: Partial<Record<string, unknown>>) {
  return {
    day: daysAgo(1),
    provider: "anthropic",
    origin: "agent-chat",
    operation: "chat",
    model: "claude-sonnet-5",
    trigger_source: "user",
    calls: 1,
    errors: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    audio_seconds: 0,
    cost_usd: 0,
    avg_duration_ms: 0,
    ...over,
  };
}

const mockRows = [
  row({ origin: "agent-chat", cost_usd: 12, calls: 40, input_tokens: 500_000, cache_read_tokens: 1_500_000 }),
  row({ origin: "agent-chat", cost_usd: 3, calls: 10, day: daysAgo(2) }),
  row({ origin: "editorial-engine", provider: "lovable", model: "google/gemini-2.5-flash", trigger_source: "cron", cost_usd: 5, calls: 144 }),
  row({ origin: "transcribe-audio-long", provider: "assemblyai", model: "universal", trigger_source: "cron", cost_usd: 2, calls: 3, audio_seconds: 3600 }),
  row({ origin: "crm-ai-assist", cost_usd: 0.5, calls: 6, errors: 2 }),
];

const getApiUsageDaily = vi.fn();
const getApiUsageTopCalls = vi.fn();

vi.mock("@/lib/supabase-rpc", () => ({
  rpc: {
    getApiUsageDaily: (...a: unknown[]) => getApiUsageDaily(...a),
    getApiUsageTopCalls: (...a: unknown[]) => getApiUsageTopCalls(...a),
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
  Legend: () => null,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span />,
  Bot: () => <span />,
  CircleDollarSign: () => <span />,
  Clock: () => <span />,
  Cpu: () => <span />,
  Flame: () => <span />,
  ShieldAlert: () => <span />,
  Zap: () => <span />,
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ApiUsageTab", () => {
  beforeEach(() => {
    getApiUsageDaily.mockClear();
    getApiUsageTopCalls.mockClear();
    getApiUsageDaily.mockResolvedValue({ data: mockRows, error: null });
    getApiUsageTopCalls.mockResolvedValue({
      data: [
        {
          id: "c1",
          created_at: new Date().toISOString(),
          provider: "assemblyai",
          origin: "google-drive-helper",
          operation: "poll-transcript",
          model: "universal",
          trigger_source: "cron",
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          audio_seconds: 12_000,
          cost_usd: 0.9,
          duration_ms: null,
          status: "success",
          error_message: null,
        },
      ],
      error: null,
    });
  });

  it("agrège le coût total sur la période", async () => {
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    // 12 + 3 + 5 + 2 + 0.5
    expect(await screen.findByText("$22.50")).toBeInTheDocument();
    expect(screen.getByText("Coût total")).toBeInTheDocument();
  });

  it("classe les origines par coût décroissant", async () => {
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    await screen.findByText("$22.50");
    const origins = screen
      .getAllByText(/agent-chat|editorial-engine|transcribe-audio-long|crm-ai-assist/)
      .map((el) => el.textContent?.trim());
    // agent-chat cumule 12 + 3 = 15, donc en tête.
    expect(origins[0]).toContain("agent-chat");
  });

  it("isole la part déclenchée automatiquement", async () => {
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    await screen.findByText("$22.50");
    // crons : 5 + 2 = 7 sur 22,50 → 31%
    expect(screen.getByText("Part automatique")).toBeInTheDocument();
    expect(screen.getByText("31%")).toBeInTheDocument();
  });

  it("compte les appels et les erreurs", async () => {
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    await screen.findByText("$22.50");
    expect(screen.getByText("203")).toBeInTheDocument(); // 40+10+144+3+6
    expect(screen.getByText("2 en erreur")).toBeInTheDocument();
  });

  it("affiche les secondes d'audio plutôt que des tokens pour AssemblyAI", async () => {
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    await screen.findByText("$22.50");
    expect(screen.getByText("60 min audio")).toBeInTheDocument();
  });

  it("refuse l'accès quand le RPC rejette un non-administrateur", async () => {
    getApiUsageDaily.mockResolvedValue({
      data: null,
      error: new Error("Accès réservé aux administrateurs"),
    });

    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    expect(
      await screen.findByText("Accès réservé aux administrateurs."),
    ).toBeInTheDocument();
    // Le second RPC ne doit pas être tenté après un refus.
    expect(getApiUsageTopCalls).not.toHaveBeenCalled();
  });

  it("affiche la durée audio et non des tokens à zéro dans le top des appels", async () => {
    // Une transcription facturée à la minute affichait « 0 / 0 » pour 0,90 $ :
    // la ligne paraissait absurde.
    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    await screen.findByText("$22.50");
    expect(await screen.findByText("200 min audio")).toBeInTheDocument();
    expect(screen.getByText("Appels unitaires les plus coûteux")).toBeInTheDocument();
  });

  it("affiche l'état vide quand rien n'est encore tracé", async () => {
    getApiUsageDaily.mockResolvedValue({ data: [], error: null });

    const { default: ApiUsageTab } = await import("./ApiUsageTab");
    renderWithQuery(<ApiUsageTab />);

    expect(
      await screen.findByText("Aucune consommation enregistrée sur cette période."),
    ).toBeInTheDocument();
  });
});
