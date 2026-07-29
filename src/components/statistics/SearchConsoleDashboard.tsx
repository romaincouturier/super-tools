import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MousePointerClick, Eye, Percent, TrendingUp, AlertCircle, RefreshCw, Search, FileText,
  Globe, Smartphone, Sparkles, Target, FileWarning, Link2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/lib/toast";
import {
  useGscPerformance, useGscOpportunities, useGscIndexation, useGscSync,
  type GscDimensionRow, type GscHistoryDimension,
} from "@/hooks/useGscStatistics";
import SeoOpportunitiesPanel from "./SeoOpportunitiesPanel";
import SeoIndexationPanel from "./SeoIndexationPanel";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { PERIOD_LABELS, periodToRange, formatPeriodLabel, type Period } from "./statsPeriods";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("fr-FR");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Delta({ value, suffix = "%", invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  const color = neutral ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-destructive";
  const sign = value > 0 ? "+" : "";
  return <span className={`text-xs font-medium ${color}`}>{sign}{value.toFixed(1)}{suffix}</span>;
}

function StatCard({
  label, value, icon: Icon, delta, deltaSuffix, invertDelta, comparisonLabel,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number | null;
  deltaSuffix?: string;
  invertDelta?: boolean;
  comparisonLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-xl font-bold">{value}</div>
          <Delta value={delta ?? null} suffix={deltaSuffix} invert={invertDelta} />
        </div>
        {comparisonLabel ? <div className="text-[11px] text-muted-foreground mt-1">{comparisonLabel}</div> : null}
      </CardContent>
    </Card>
  );
}

function DimensionTable({ rows, keyLabel, showSecondKey }: { rows: GscDimensionRow[] | undefined; keyLabel: string; showSecondKey?: boolean }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée sur cette période</p>;
  }
  return (
    <div className="overflow-auto max-h-[420px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">{keyLabel}</th>
            {showSecondKey ? <th className="py-2 pr-4 font-medium text-muted-foreground">Requête</th> : null}
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Clics</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Évolution</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Impressions</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">CTR</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Position</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Gain position</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.key}-${r.key_2 ?? ""}-${i}`} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[320px]" title={r.key}>{r.key.startsWith("http") ? shortUrl(r.key) : r.key || "—"}</td>
              {showSecondKey ? <td className="py-1.5 pr-4 truncate max-w-[220px]">{r.key_2 || "—"}</td> : null}
              <td className="py-1.5 pr-4 text-right font-medium">{fmtNum(r.clicks)}</td>
              <td className="py-1.5 pr-4 text-right">
                {r.delta_clicks === undefined ? "—" : (
                  <span className={r.delta_clicks > 0 ? "text-emerald-600" : r.delta_clicks < 0 ? "text-destructive" : "text-muted-foreground"}>
                    {r.delta_clicks > 0 ? "+" : ""}{fmtNum(r.delta_clicks)}
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtPct(r.ctr)}</td>
              <td className="py-1.5 pr-4 text-right">{r.position.toFixed(1)}</td>
              <td className="py-1.5 pr-4 text-right">
                {r.delta_position === undefined ? "—" : (
                  <span className={r.delta_position > 0 ? "text-emerald-600" : r.delta_position < 0 ? "text-destructive" : "text-muted-foreground"}>
                    {r.delta_position > 0 ? "+" : ""}{r.delta_position.toFixed(1)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DIMENSION_TABS: Array<{ value: GscHistoryDimension; label: string; keyLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "query", label: "Requêtes", keyLabel: "Requête", icon: Search },
  { value: "page", label: "Pages", keyLabel: "Page", icon: FileText },
  { value: "page_query", label: "Page × requête", keyLabel: "Page", icon: Link2 },
  { value: "country", label: "Pays", keyLabel: "Pays", icon: Globe },
  { value: "device", label: "Appareils", keyLabel: "Appareil", icon: Smartphone },
  { value: "appearance", label: "Apparence", keyLabel: "Type de résultat", icon: Sparkles },
];

const SearchConsoleDashboard = () => {
  const [period, setPeriod] = useState<Period>("90d");
  const [dimension, setDimension] = useState<GscHistoryDimension>("query");
  const queryClient = useQueryClient();

  // Search Console publie avec environ deux jours de décalage.
  const { from, to, days } = useMemo(() => periodToRange(period, 2), [period]);
  const range = useMemo(() => ({ from, to }), [from, to]);
  const periodLabel = `${PERIOD_LABELS[period]} · ${formatPeriodLabel(from, to)}`;

  const performance = useGscPerformance(dimension, range, dimension === "page_query" ? 200 : 100);
  const opportunities = useGscOpportunities(range);
  const indexation = useGscIndexation();
  const sync = useGscSync();

  const chartData = useMemo(
    () => (performance.data?.daily ?? []).map((r) => ({ date: r.date, clics: r.clicks, impressions: r.impressions })),
    [performance.data],
  );

  const runSync = () => {
    sync.mutate(
      { mode: "metrics", days: Math.min(days, 30) },
      {
        onSuccess: () => {
          toast.success("Synchronisation Search Console terminée");
          queryClient.invalidateQueries({ queryKey: ["gsc-statistics"] });
        },
        onError: (e) => toast.error("Synchronisation impossible", {
          cause: e,
          description: e instanceof Error ? e.message : String(e),
        }),
      },
    );
  };

  if (performance.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (performance.error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Impossible de charger Google Search Console : {(performance.error as Error).message}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            Vérifiez que la propriété Search Console est configurée dans Paramètres → Intégrations et que le compte Google est
            connecté avec le droit Search Console.
          </p>
          <Button variant="outline" size="sm" className="mt-4 ml-6" onClick={runSync} disabled={sync.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
            Relancer la synchronisation
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = performance.data;
  const coverage = data?.data_coverage;
  const totals = data?.totals ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const evolution = data?.evolution;
  const comparisonLabel = data?.previous_period
    ? `vs ${formatPeriodLabel(data.previous_period.from, data.previous_period.to)}`
    : undefined;

  const noHistory = !coverage?.first_date;
  const partialHistory = !noHistory && coverage!.first_date! > from;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Période analysée : <span className="font-medium text-foreground">{periodLabel}</span>
          <span className="ml-2 text-xs">(données disponibles avec ~2 jours de décalage)</span>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => { if (v) setPeriod(v as Period); }}
            variant="outline"
            size="sm"
          >
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <ToggleGroupItem key={p} value={p} aria-label={PERIOD_LABELS[p]}>
                {PERIOD_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={runSync} disabled={sync.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
            Synchroniser
          </Button>
        </div>
      </div>

      {noHistory ? (
        <Card>
          <CardContent className="py-6 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <FileWarning className="h-4 w-4" />
              Aucun historique Search Console encore synchronisé
            </div>
            <p className="text-muted-foreground mt-2">
              La synchronisation tourne chaque nuit. Lancez-la manuellement pour remplir la période affichée, puis relancez-la avec
              une plage plus large pour rattraper l'historique (Google conserve 16 mois).
            </p>
          </CardContent>
        </Card>
      ) : partialHistory ? (
        <p className="text-xs text-muted-foreground">
          Historique disponible depuis le {new Date(coverage!.first_date!).toLocaleDateString("fr-FR")} : la période affichée est
          partiellement couverte.
        </p>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Clics" value={fmtNum(totals.clicks)} icon={MousePointerClick}
          delta={evolution?.clicks_pct ?? null} comparisonLabel={comparisonLabel}
        />
        <StatCard
          label="Impressions" value={fmtNum(totals.impressions)} icon={Eye}
          delta={evolution?.impressions_pct ?? null} comparisonLabel={comparisonLabel}
        />
        <StatCard
          label="CTR moyen" value={fmtPct(totals.ctr)} icon={Percent}
          delta={evolution?.ctr_points ?? null} deltaSuffix=" pts" comparisonLabel={comparisonLabel}
        />
        <StatCard
          label="Position moyenne" value={totals.position.toFixed(1)} icon={TrendingUp}
          delta={evolution?.position_gain ?? null} deltaSuffix="" comparisonLabel={comparisonLabel}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Clics et impressions
            <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée sur cette période</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval={days >= 60 ? Math.floor(chartData.length / 8) : "preserveStartEnd"}
                  minTickGap={16}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="clics" name="Clics" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="query" className="space-y-4" onValueChange={(v) => {
        if (v !== "opportunities" && v !== "indexation") setDimension(v as GscHistoryDimension);
      }}>
        <TabsList className="flex-wrap h-auto gap-1">
          {DIMENSION_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="opportunities" className="gap-1.5"><Target className="h-3.5 w-3.5" />Opportunités</TabsTrigger>
          <TabsTrigger value="indexation" className="gap-1.5"><FileWarning className="h-3.5 w-3.5" />Indexation</TabsTrigger>
        </TabsList>

        {DIMENSION_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performance.isFetching && dimension === t.value ? (
                  <Spinner />
                ) : (
                  <DimensionTable
                    rows={dimension === t.value ? data?.rows : undefined}
                    keyLabel={t.keyLabel}
                    showSecondKey={t.value === "page_query"}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="opportunities">
          <SeoOpportunitiesPanel data={opportunities.data} isLoading={opportunities.isLoading} error={opportunities.error} />
        </TabsContent>

        <TabsContent value="indexation">
          <SeoIndexationPanel data={indexation.data} isLoading={indexation.isLoading} error={indexation.error} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchConsoleDashboard;
