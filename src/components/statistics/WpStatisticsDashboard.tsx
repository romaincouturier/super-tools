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

// Concrete palette — avoids relying on `--chart-N` CSS vars which may be
// undefined in some themes and would render the pie cells as solid black.
const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
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
type RawSeriesEntry = Record<string, unknown>;

function toDailySeries(raw: unknown, valueKeys: string[]): Array<{ date: string; value: number }> {
  if (!raw || typeof raw !== "object") return [];
  const entries: RawSeriesEntry[] = Array.isArray(raw)
    ? (raw as RawSeriesEntry[])
    : Object.entries(raw as Record<string, unknown>).map(([date, val]) => {
        if (val && typeof val === "object") return { date, ...(val as Record<string, unknown>) };
        return { date, value: val };
      });

  const out: Array<{ date: string; value: number }> = [];
  for (const e of entries) {
    const date = String(e.date ?? e.day ?? "");
    if (!date) continue;
    let value = 0;
    for (const k of valueKeys) {
      const v = e[k];
      if (typeof v === "number") { value = v; break; }
      if (typeof v === "string" && v !== "") { value = Number(v) || 0; break; }
    }
    out.push({ date, value });
  }
  return out;
}

/* ─── Summary Cards ─── */
function SummaryCards({ summary }: { summary: Record<string, unknown> }) {
  const visitors = (summary?.visitors ?? {}) as Record<string, number | undefined>;
  const visits = (summary?.visits ?? {}) as Record<string, number | undefined>;
  const onlineCount = (summary?.user_online as number | undefined) ?? 0;
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
function PieChartCard({ data, nameKey = "name", valueKey = "value" }: { data: unknown; nameKey?: string; valueKey?: string }) {
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

  const rawItems: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Object.entries(data as Record<string, unknown>).map(([name, value]) => ({
        name,
        value: typeof value === "object" && value !== null ? ((value as Record<string, unknown>)?.count ?? 0) : value,
      }));

  const chartData = rawItems
    .slice(0, 8)
    .map((b) => ({
      name: String(b.agent ?? b.browser ?? b.platform ?? b.country ?? b.engine ?? b.name ?? b[nameKey] ?? "Autre"),
      value: Number(b.count ?? b.hits ?? b.value ?? b[valueKey] ?? 0),
    }))
    .filter((d) => d.value > 0);

  if (chartData.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ─── Hits trend chart (hits payload contains daily { date, visitor, visit }) ─── */
function TrendChart({ hitsData, days }: { hitsData: unknown; days: number }) {
  if (!Array.isArray(hitsData) || hitsData.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée de tendance</p>;
  }

  const chartData = (hitsData as Record<string, unknown>[]).map((e) => ({
    date: String(e.date ?? e.day ?? ""),
    views: Number(e.visit ?? e.views ?? e.hits ?? e.count ?? 0),
    visitors: Number(e.visitor ?? e.visitors ?? 0),
  }));

  const isMonthlyTicks = days >= 60;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval={isMonthlyTicks ? Math.floor(chartData.length / 8) : "preserveStartEnd"}
          minTickGap={16}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey="views" name="Vues" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
        <Area type="monotone" dataKey="visitors" name="Visiteurs" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Data Table generic ─── */
function DataTable({ data, columns, emptyMsg = "Aucune donnée", maxRows = 20 }: {
  data: unknown;
  columns: { key: string; label: string; align?: "left" | "right"; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  emptyMsg?: string;
  maxRows?: number;
}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMsg}</p>;
  }

  const rows = data as Record<string, unknown>[];

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
          {rows.slice(0, maxRows).map((row, i: number) => (
            <tr key={i} className="border-b border-border/50">
              {columns.map((col) => (
                <td key={col.key} className={`py-1.5 pr-4 ${col.align === "right" ? "text-right font-medium" : "truncate max-w-[300px]"}`}>
                  {col.render ? col.render(row) : ((row[col.key] as React.ReactNode) || "—")}
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

function detectProductPages(pages: unknown): { slug: string | null; items: Record<string, unknown>[] } {
  if (!Array.isArray(pages) || pages.length === 0) return { slug: null, items: [] };

  const typedPages = pages as Record<string, unknown>[];
  const counts = new Map<string, number>();
  for (const page of typedPages) {
    const uri: string = String(page?.uri ?? page?.page ?? "");
    if (!uri) continue;
    const first = uri.split("/").filter(Boolean)[0]?.toLowerCase();
    if (first && KNOWN_PRODUCT_SLUGS.includes(first)) {
      counts.set(first, (counts.get(first) || 0) + 1);
    }
  }
  if (counts.size === 0) return { slug: null, items: [] };

  const [slug] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const items = typedPages.filter((p) => {
    const uri: string = String(p?.uri ?? p?.page ?? "").toLowerCase();
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

  // Aggregate pages by URI (the API returns one row per day per URI)
  const aggregatedPages = useMemo(() => {
    if (!Array.isArray(pages)) return [];
    const map = new Map<string, { uri: string; title?: string; count: number }>();
    for (const p of pages as Record<string, unknown>[]) {
      const uri: string = String(p?.uri ?? p?.page ?? "");
      if (!uri) continue;
      const c = Number(p?.count ?? p?.hits ?? p?.views ?? 0);
      const cur = map.get(uri);
      if (cur) cur.count += c;
      else map.set(uri, { uri, title: p?.title as string | undefined, count: c });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [pages]);

  const productPages = useMemo(() => detectProductPages(aggregatedPages), [aggregatedPages]);

  const GLOBAL_NOTICE = "Donnée globale (l'API WP-Statistics ne filtre pas ce rapport par période).";

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
          {loadingHits ? <Spinner /> : <TrendChart hitsData={hits} days={days} />}
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
                  data={aggregatedPages}
                  maxRows={20}
                  columns={[
                    { key: "title", label: "Page", render: (r) => r.title || r.uri || "—" },
                    { key: "count", label: "Vues", align: "right", render: (r) => r.count ?? 0 },
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
                    { key: "title", label: "Produit", render: (r) => r.title || r.uri || "—" },
                    { key: "count", label: "Vues", align: "right", render: (r) => r.count ?? 0 },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrers">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sources de trafic</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{GLOBAL_NOTICE}</p>
            </CardHeader>
            <CardContent>
              {loadingReferrers ? <Spinner /> : (() => {
                const list = Array.isArray(referrers)
                  ? (referrers as Record<string, unknown>[]).map((r) => ({
                      domain: String(r.referred ?? r.domain ?? r.referrer ?? "(direct)"),
                      count: Number(r.total ?? r.count ?? r.hits ?? 0),
                    }))
                  : referrers
                    ? Object.entries(referrers as Record<string, unknown>).map(([domain, val]) => ({
                        domain: domain || "(direct)",
                        count: typeof val === "number" ? val : Number((val as Record<string, unknown>)?.total ?? (val as Record<string, unknown>)?.count ?? 0),
                      }))
                    : [];
                const sorted = list.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DataTable
                      data={sorted}
                      columns={[
                        { key: "domain", label: "Source", render: (r) => r.domain || "—" },
                        { key: "count", label: "Visites", align: "right", render: (r) => r.count },
                      ]}
                    />
                    <PieChartCard data={sorted} nameKey="domain" valueKey="count" />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Moteurs de recherche</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Visites entrantes provenant de Google, Bing, etc. (pas la recherche interne au site). {GLOBAL_NOTICE}
              </p>
            </CardHeader>
            <CardContent>
              {loadingSearch ? <Spinner /> : errorSearch ? <ErrorState message="Erreur chargement moteurs de recherche" /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(search) ? search : search ? Object.entries(search as Record<string, unknown>).map(([engine, val]) => ({ engine, count: typeof val === "number" ? val : ((val as Record<string, unknown>)?.count ?? 0) })) : []}
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
              <CardTitle className="text-base">Navigateurs</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{GLOBAL_NOTICE}</p>
            </CardHeader>
            <CardContent>
              {loadingBrowsers ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(browsers) ? browsers : browsers ? Object.entries(browsers as Record<string, unknown>).map(([name, val]) => ({ name, count: typeof val === "number" ? val : ((val as Record<string, unknown>)?.count ?? 0) })) : []}
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
