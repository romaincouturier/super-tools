import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MousePointerClick, Eye, Percent, TrendingUp, AlertCircle, RefreshCw, Search, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGscSearchAnalytics, type GscRow } from "@/hooks/useGscStatistics";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { PERIOD_LABELS, periodToRange, formatPeriodLabel, type Period } from "./statsPeriods";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("fr-FR");

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function GscTable({ rows, keyLabel }: { rows: GscRow[] | undefined; keyLabel: string }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée</p>;
  }
  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">{keyLabel}</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Clics</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Impressions</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">CTR</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Position</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[350px]">{r.key || "—"}</td>
              <td className="py-1.5 pr-4 text-right font-medium">{fmtNum(r.clicks)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtPct(r.ctr)}</td>
              <td className="py-1.5 pr-4 text-right">{r.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SearchConsoleDashboard = () => {
  const [period, setPeriod] = useState<Period>("90d");
  const queryClient = useQueryClient();
  // Les données Search Console sont disponibles avec ~2 jours de décalage.
  const { from, to, days } = useMemo(() => periodToRange(period, 2), [period]);
  const range = useMemo(() => ({ from, to }), [from, to]);
  const periodLabel = `${PERIOD_LABELS[period]} · ${formatPeriodLabel(from, to)}`;

  const { data: byDate, isLoading: loadingDates, error: errorDates, isFetching } = useGscSearchAnalytics("date", range, 1000);
  const { data: byQuery, isLoading: loadingQueries } = useGscSearchAnalytics("query", range, 200);
  const { data: byPage, isLoading: loadingPages } = useGscSearchAnalytics("page", range, 200);

  const totals = useMemo(() => {
    const rows = byDate ?? [];
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const weightedPos = rows.reduce((s, r) => s + r.position * r.impressions, 0);
    return {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: impressions > 0 ? weightedPos / impressions : 0,
    };
  }, [byDate]);

  const chartData = useMemo(
    () => (byDate ?? []).map((r) => ({ date: r.key, clics: r.clicks, impressions: r.impressions })),
    [byDate],
  );

  const reimport = () => queryClient.invalidateQueries({ queryKey: ["gsc-statistics"] });

  if (loadingDates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (errorDates) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Impossible de charger Google Search Console : {(errorDates as Error).message}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            Vérifiez que la propriété Search Console est configurée dans Paramètres → Intégrations et que le compte Google est connecté avec le droit Search Console.
          </p>
          <Button variant="outline" size="sm" className="mt-4 ml-6" onClick={reimport}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

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
          <Button variant="outline" size="sm" onClick={reimport} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Réimporter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Clics" value={fmtNum(totals.clicks)} icon={MousePointerClick} />
        <StatCard label="Impressions" value={fmtNum(totals.impressions)} icon={Eye} />
        <StatCard label="CTR moyen" value={fmtPct(totals.ctr)} icon={Percent} />
        <StatCard label="Position moyenne" value={totals.position.toFixed(1)} icon={TrendingUp} />
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

      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="queries" className="gap-1.5"><Search className="h-3.5 w-3.5" />Requêtes</TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="queries">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Requêtes les plus performantes
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingQueries ? <Spinner /> : <GscTable rows={byQuery} keyLabel="Requête" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Pages les plus performantes
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPages ? <Spinner /> : <GscTable rows={byPage} keyLabel="Page" />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchConsoleDashboard;
