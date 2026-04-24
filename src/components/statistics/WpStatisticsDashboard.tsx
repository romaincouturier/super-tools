import { useMemo, useState } from "react";
import { Globe, Users, Eye, Monitor, Link2, AlertCircle, Activity, TrendingUp, Search, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useWpSummary, useWpPages, useWpBrowsers, useWpReferrers,
  useWpHits, useWpVisitors, useWpSearch,
} from "@/hooks/useWpStatistics";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { dateAsISO } from "@/lib/dateFormatters";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
  "#6366f1",
  "#f59e0b",
];

/* ─── Period helpers ─── */
type Period = "7d" | "30d" | "90d" | "365d";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "3 mois",
  "365d": "12 mois",
};

function periodToRange(period: Period): { from: string; to: string; days: number } {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: dateAsISO(from), to: dateAsISO(today), days };
}

function formatPeriodLabel(from: string, to: string) {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return `${fmt(from)} → ${fmt(to)}`;
}

/* ─── Generic series normalizer ─── */
function toDailySeries(raw: any, valueKeys: string[]): Array<{ date: string; value: number }> {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw)
    ? raw
    : Object.entries(raw).map(([date, val]) => {
        if (val && typeof val === "object") return { date, ...(val as Record<string, unknown>) };
        return { date, value: val };
      });

  const out: Array<{ date: string; value: number }> = [];
  for (const e of entries) {
    const date = (e as any).date || (e as any).day || "";
    if (!date) continue;
    let value = 0;
    for (const k of valueKeys) {
      const v = (e as any)[k];
      if (typeof v === "number") { value = v; break; }
      if (typeof v === "string" && v !== "") { value = Number(v) || 0; break; }
    }
    out.push({ date, value });
  }
  return out;
}

/* ─── Summary Cards ─── */
function SummaryCards({ summary }: { summary: Record<string, any> }) {
  const visitors = summary?.visitors ?? {};
  const visits = summary?.visits ?? {};
  const onlineCount = summary?.user_online ?? 0;
  const cards = [
    { label: "En ligne", value: onlineCount, sub: "maintenant", icon: Activity, highlight: true },
    { label: "Aujourd'hui", visitors: visitors.today, views: visits.today, icon: Eye },
    { label: "Hier", visitors: visitors.yesterday, views: visits.yesterday, icon: Eye },
    { label: "Cette semaine", visitors: visitors.this_week ?? visitors.week, views: visits.this_week ?? visits.week, icon: Users },
    { label: "Ce mois", visitors: visitors.this_month ?? visitors.month, views: visits.this_month ?? visits.month, icon: Globe },
    { label: "Total", visitors: visitors.total, views: visits.total, icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className={c.highlight ? "border-primary/50 bg-primary/5" : ""}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`h-4 w-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
            </div>
            {"value" in c ? (
              <>
                <div className={`text-xl font-bold ${c.highlight ? "text-primary" : ""}`}>{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.sub}</div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold">{c.views ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{c.visitors ?? "—"} visiteurs</div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Pie / Donut chart generic ─── */
function PieChartCard({ data, nameKey = "name", valueKey = "value" }: { data: any; nameKey?: string; valueKey?: string }) {
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

  const rawItems = Array.isArray(data)
    ? data
    : Object.entries(data).map(([name, value]) => ({ name, value: typeof value === "object" ? (value as any)?.count || 0 : value }));

  const chartData = rawItems
    .slice(0, 8)
    .map((b: any) => ({
      name: b.agent || b.browser || b.platform || b.country || b.engine || b.name || b[nameKey] || "Autre",
      value: Number(b.count || b.hits || b.value || b[valueKey] || 0),
    }))
    .filter((d: any) => d.value > 0);

  if (chartData.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ─── Hits / Visitors trend chart ─── */
function TrendChart({ hitsData, visitorsData, days }: { hitsData: any; visitorsData: any; days: number }) {
  const hitsSeries = toDailySeries(hitsData, ["views", "count", "hits", "visit", "value"]);
  const visitorsSeries = toDailySeries(visitorsData, ["visitors", "visitor", "count", "value"]);

  const byDate = new Map<string, { date: string; views: number; visitors: number }>();
  for (const h of hitsSeries) {
    byDate.set(h.date, { date: h.date, views: h.value, visitors: 0 });
  }
  for (const v of visitorsSeries) {
    const existing = byDate.get(v.date);
    if (existing) existing.visitors = v.value;
    else byDate.set(v.date, { date: v.date, views: 0, visitors: v.value });
  }

  const chartData = Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);

  if (chartData.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée de tendance</p>;

  // For periods ≥ 60 days : show one tick per month (1st day of month), label = short month name ("janv.").
  // For shorter periods : show ticks as short day+month ("15 janv.").
  const isMonthlyTicks = days >= 60;
  const monthlyTickDates = isMonthlyTicks
    ? chartData
        .filter((d) => d.date.endsWith("-01"))
        .map((d) => d.date)
    : undefined;

  const formatTick = (iso: string) => {
    try {
      const d = parseISO(iso);
      return isMonthlyTicks ? format(d, "MMM yyyy", { locale: fr }) : format(d, "d MMM", { locale: fr });
    } catch {
      return iso;
    }
  };

  const formatTooltipLabel = (iso: string) => {
    try {
      return format(parseISO(iso), "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return iso;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={formatTick}
          ticks={monthlyTickDates}
          interval={isMonthlyTicks ? 0 : "preserveStartEnd"}
          minTickGap={16}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip labelFormatter={formatTooltipLabel} />
        <Legend />
        <Area type="monotone" dataKey="views" name="Vues" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
        <Area type="monotone" dataKey="visitors" name="Visiteurs" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Data Table generic ─── */
function DataTable({ data, columns, emptyMsg = "Aucune donnée", maxRows = 20 }: {
  data: any;
  columns: { key: string; label: string; align?: "left" | "right"; render?: (row: any) => React.ReactNode }[];
  emptyMsg?: string;
  maxRows?: number;
}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMsg}</p>;
  }

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {columns.map((col) => (
              <th key={col.key} className={`py-2 pr-4 font-medium text-muted-foreground ${col.align === "right" ? "text-right" : ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, maxRows).map((row: any, i: number) => (
            <tr key={i} className="border-b border-border/50">
              {columns.map((col) => (
                <td key={col.key} className={`py-1.5 pr-4 ${col.align === "right" ? "text-right font-medium" : "truncate max-w-[300px]"}`}>
                  {col.render ? col.render(row) : (row[col.key] || "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-4">
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

/* ─── Product page detection ─── */
const KNOWN_PRODUCT_SLUGS = ["produit", "product", "produits", "products", "shop", "boutique"];

function detectProductPages(pages: any): { slug: string | null; items: any[] } {
  if (!Array.isArray(pages) || pages.length === 0) return { slug: null, items: [] };

  const counts = new Map<string, number>();
  for (const page of pages) {
    const uri: string = page?.uri || page?.page || "";
    if (!uri) continue;
    const first = uri.split("/").filter(Boolean)[0]?.toLowerCase();
    if (first && KNOWN_PRODUCT_SLUGS.includes(first)) {
      counts.set(first, (counts.get(first) || 0) + 1);
    }
  }
  if (counts.size === 0) return { slug: null, items: [] };

  const [slug] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const items = pages.filter((p: any) => {
    const uri: string = (p?.uri || p?.page || "").toLowerCase();
    return uri.startsWith(`/${slug}/`) || uri.startsWith(`${slug}/`);
  });
  return { slug, items };
}

/* ─── Main Dashboard ─── */
const WpStatisticsDashboard = () => {
  const [period, setPeriod] = useState<Period>("90d");
  const { from, to, days } = useMemo(() => periodToRange(period), [period]);
  const range = useMemo(() => ({ from, to }), [from, to]);
  const periodLabel = `${PERIOD_LABELS[period]} · ${formatPeriodLabel(from, to)}`;

  const { data: summary, isLoading: loadingSummary, error: errorSummary } = useWpSummary();
  const { data: pages, isLoading: loadingPages, error: errorPages } = useWpPages({ ...range, per_page: "100" });
  const { data: browsers, isLoading: loadingBrowsers } = useWpBrowsers(range);
  const { data: referrers, isLoading: loadingReferrers } = useWpReferrers(range);
  const { data: hits, isLoading: loadingHits } = useWpHits(range);
  const { data: visitors, isLoading: loadingVisitors } = useWpVisitors(range);
  const { data: search, isLoading: loadingSearch, error: errorSearch } = useWpSearch(range);

  const productPages = useMemo(() => detectProductPages(pages), [pages]);

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (errorSummary) {
    return (
      <Card>
        <CardContent className="py-8">
          <ErrorState message={`Impossible de charger les statistiques WP : ${(errorSummary as Error).message}`} />
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            Vérifiez que le token WP-Statistics est configuré dans Paramètres → Intégrations et que l'add-on REST API est actif sur WordPress.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {summary && <SummaryCards summary={summary} />}

      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Période analysée : <span className="font-medium text-foreground">{periodLabel}</span>
        </div>
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
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tendance des visites
            <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(loadingHits || loadingVisitors) ? <Spinner /> : <TrendChart hitsData={hits} visitorsData={visitors} days={days} />}
        </CardContent>
      </Card>

      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pages" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Pages</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Pages produits</TabsTrigger>
          <TabsTrigger value="referrers" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Sources</TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5"><Search className="h-3.5 w-3.5" />Moteurs de recherche</TabsTrigger>
          <TabsTrigger value="browsers" className="gap-1.5"><Monitor className="h-3.5 w-3.5" />Navigateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Pages les plus vues
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPages ? <Spinner /> : errorPages ? <ErrorState message="Erreur chargement pages" /> : (
                <DataTable
                  data={pages}
                  maxRows={20}
                  columns={[
                    { key: "title", label: "Page", render: (r) => r.title || r.uri || r.page || "—" },
                    { key: "count", label: "Vues", align: "right", render: (r) => r.count || r.hits || r.views || 0 },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Pages produits
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
              {productPages.slug && (
                <p className="text-xs text-muted-foreground mt-1">
                  Filtre détecté automatiquement sur le préfixe <code className="px-1 py-0.5 rounded bg-muted">/{productPages.slug}/</code>
                </p>
              )}
            </CardHeader>
            <CardContent>
              {loadingPages ? <Spinner /> : errorPages ? <ErrorState message="Erreur chargement pages" /> : !productPages.slug ? (
                <p className="text-sm text-muted-foreground">
                  Aucune page produit détectée sur cette période. Slugs reconnus : {KNOWN_PRODUCT_SLUGS.map((s) => `/${s}/`).join(", ")}.
                </p>
              ) : (
                <DataTable
                  data={productPages.items}
                  maxRows={50}
                  emptyMsg={`Aucune vue sur les pages /${productPages.slug}/ pour cette période.`}
                  columns={[
                    { key: "title", label: "Produit", render: (r) => r.title || r.uri || r.page || "—" },
                    { key: "count", label: "Vues", align: "right", render: (r) => r.count || r.hits || r.views || 0 },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrers">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Sources de trafic
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReferrers ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(referrers) ? referrers : referrers ? Object.entries(referrers).map(([domain, val]) => ({ domain, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "domain", label: "Source", render: (r) => r.domain || r.referrer || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || 0 },
                    ]}
                  />
                  <PieChartCard data={referrers} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Moteurs de recherche
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Visites entrantes provenant de Google, Bing, etc. (pas la recherche interne au site).
              </p>
            </CardHeader>
            <CardContent>
              {loadingSearch ? <Spinner /> : errorSearch ? <ErrorState message="Erreur chargement moteurs de recherche" /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(search) ? search : search ? Object.entries(search).map(([engine, val]) => ({ engine, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "engine", label: "Moteur", render: (r) => r.engine || r.name || r.search_engine || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || r.value || 0 },
                    ]}
                  />
                  <PieChartCard data={search} nameKey="engine" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="browsers">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Navigateurs
                <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBrowsers ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(browsers) ? browsers : browsers ? Object.entries(browsers).map(([name, val]) => ({ name, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "name", label: "Navigateur", render: (r) => r.agent || r.browser || r.name || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || r.value || 0 },
                    ]}
                  />
                  <PieChartCard data={browsers} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WpStatisticsDashboard;
