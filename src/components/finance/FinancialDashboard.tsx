import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, TrendingUp, Wallet, Percent, ArrowDown, ArrowUp, Minus, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import KpiCard from "@/components/finance/KpiCard";
import { EUR } from "@/components/finance/InvoicesTable";
import {
  useFinancialKPIs,
  periodLast12Months,
  periodCurrentYear,
  periodPreviousYear,
  type PeriodRange,
  type KPIWithChange,
} from "@/hooks/useFinancialKPIs";

type PresetKey = "last12" | "currentYear" | "previousYear";

const PRESETS: Record<PresetKey, { label: string; range: () => PeriodRange }> = {
  last12: { label: "12 derniers mois", range: periodLast12Months },
  currentYear: { label: "Année en cours", range: periodCurrentYear },
  previousYear: { label: "Année précédente", range: periodPreviousYear },
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function pctLabel(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)} %`;
}

function trendIcon(pct: number | null) {
  if (pct === null || pct === 0) return Minus;
  return pct > 0 ? ArrowUp : ArrowDown;
}

function trendTone(pct: number | null, invert = false): "default" | "positive" | "negative" {
  if (pct === null || pct === 0) return "default";
  const positive = invert ? pct < 0 : pct > 0;
  return positive ? "positive" : "negative";
}

function ChangeBadge({ kpi, invert = false }: { kpi: KPIWithChange; invert?: boolean }) {
  const Icon = trendIcon(kpi.pct);
  const tone = trendTone(kpi.pct, invert);
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-1 text-xs ${toneClass}`}>
      <Icon className="h-3 w-3" />
      <span className="tabular-nums">{pctLabel(kpi.pct)}</span>
      <span className="text-muted-foreground">vs période précédente</span>
    </div>
  );
}

export default function FinancialDashboard() {
  const [preset, setPreset] = useState<PresetKey>("last12");
  const period = useMemo(() => PRESETS[preset].range(), [preset]);
  const kpis = useFinancialKPIs(period);

  const tokenMissing =
    kpis.errorMessage?.toLowerCase().includes("pennylane non configuré") ||
    kpis.errorMessage?.toLowerCase().includes("token api pennylane");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Dashboard financier</h2>
          <p className="text-sm text-muted-foreground">
            Vue synthétique du chiffre d'affaires, des charges et de la rentabilité.
          </p>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESETS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tokenMissing && (
        <Alert variant="destructive">
          <AlertTitle>Token Pennylane manquant</AlertTitle>
          <AlertDescription>
            Renseigne ton token API dans{" "}
            <a href="/parametres" className="underline font-medium">
              Paramètres → Intégrations → Pennylane
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      {kpis.hasError && !tokenMissing && (
        <Alert variant="destructive">
          <AlertTitle>Erreur Pennylane</AlertTitle>
          <AlertDescription>{kpis.errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <KpiCard
            title="CA encaissé"
            value={EUR.format(kpis.revenue.current)}
            icon={TrendingUp}
            tone="positive"
          />
          <div className="px-1 pt-1">
            <ChangeBadge kpi={kpis.revenue} />
          </div>
        </div>
        <div>
          <KpiCard
            title="Résultat net"
            value={EUR.format(kpis.netResult.current)}
            icon={Target}
            tone={kpis.netResult.current >= 0 ? "positive" : "negative"}
          />
          <div className="px-1 pt-1">
            <ChangeBadge kpi={kpis.netResult} />
          </div>
        </div>
        <div>
          <KpiCard
            title="Taux de marge"
            value={`${kpis.marginRate.current.toFixed(1)} %`}
            icon={Percent}
            tone={kpis.marginRate.current >= 0 ? "positive" : "negative"}
          />
          <div className="px-1 pt-1">
            <ChangeBadge kpi={kpis.marginRate} />
          </div>
        </div>
        <div>
          <KpiCard
            title="Trésorerie"
            value={EUR.format(kpis.cash)}
            icon={Wallet}
            hint={`${kpis.cashAccountsCount} compte(s)`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Évolution mensuelle</CardTitle>
            <CardDescription>CA encaissé et charges fournisseurs sur la période.</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.loading ? (
              <div className="flex items-center justify-center h-72">
                <Spinner size="md" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={kpis.monthlySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => EUR.format(v)}
                    labelFormatter={(label) => formatMonthLabel(String(label))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="CA"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Charges"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des charges</CardTitle>
            <CardDescription>Fixes vs variables (heuristique mots-clés).</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.loading ? (
              <div className="flex items-center justify-center h-72">
                <Spinner size="md" />
              </div>
            ) : kpis.expenseBreakdown.every((s) => s.value === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">Aucune charge sur la période.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={kpis.expenseBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {kpis.expenseBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => EUR.format(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            {!kpis.loading && kpis.netResult.current < 0 && (
              <div className="flex items-center gap-1 text-xs text-rose-600 mt-2">
                <TrendingDown className="h-3 w-3" />
                Résultat net négatif sur la période
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
