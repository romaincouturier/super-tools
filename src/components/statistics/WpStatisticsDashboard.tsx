import { Globe, Users, Eye, Monitor, Link2, Search, AlertCircle, MapPin, Smartphone, Activity, BarChart3, TrendingUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useWpSummary, useWpPages, useWpBrowsers, useWpReferrers,
  useWpSearch, useWpCountries, useWpPlatforms, useWpOnline,
  useWpHits, useWpVisitors,
} from "@/hooks/useWpStatistics";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, AreaChart, Area } from "recharts";

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

/* ─── Summary Cards ─── */
function SummaryCards({ summary, onlineCount }: { summary: Record<string, any>; onlineCount?: number }) {
  const visitors = summary?.visitors ?? {};
  const visits = summary?.visits ?? {};
  const cards = [
    { label: "En ligne", value: onlineCount ?? "—", sub: "maintenant", icon: Activity, highlight: true },
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
      name: b.agent || b.browser || b.platform || b.country || b.name || b[nameKey] || "Autre",
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
function TrendChart({ hitsData, visitorsData }: { hitsData: any; visitorsData: any }) {
  // Try to build a daily trend from hits data
  const chartData: { date: string; views: number; visitors: number }[] = [];

  if (hitsData && typeof hitsData === "object") {
    const entries = Array.isArray(hitsData) ? hitsData : Object.entries(hitsData).map(([date, val]) => ({
      date,
      views: typeof val === "number" ? val : (val as any)?.count || (val as any)?.hits || 0,
    }));

    for (const entry of entries.slice(-30)) {
      const date = entry.date || entry.day || "";
      const views = Number(entry.views || entry.count || entry.hits || entry.value || 0);
      chartData.push({ date, views, visitors: 0 });
    }
  }

  // Merge visitors data if available
  if (visitorsData && typeof visitorsData === "object") {
    const vEntries = Array.isArray(visitorsData) ? visitorsData : Object.entries(visitorsData).map(([date, val]) => ({
      date,
      visitors: typeof val === "number" ? val : (val as any)?.count || 0,
    }));
    for (const v of vEntries) {
      const existing = chartData.find((c) => c.date === (v.date || v.day));
      if (existing) {
        existing.visitors = Number(v.visitors || v.count || v.value || 0);
      }
    }
  }

  if (chartData.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée de tendance</p>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey="views" name="Vues" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
        <Area type="monotone" dataKey="visitors" name="Visiteurs" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Data Table generic ─── */
function DataTable({ data, columns, emptyMsg = "Aucune donnée" }: {
  data: any;
  columns: { key: string; label: string; align?: "left" | "right"; render?: (row: any) => React.ReactNode }[];
  emptyMsg?: string;
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
          {data.slice(0, 20).map((row: any, i: number) => (
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

/* ─── Main Dashboard ─── */
const WpStatisticsDashboard = () => {
  const { data: summary, isLoading: loadingSummary, error: errorSummary } = useWpSummary();
  const { data: pages, isLoading: loadingPages, error: errorPages } = useWpPages({ per_page: "20" });
  const { data: browsers, isLoading: loadingBrowsers } = useWpBrowsers();
  const { data: referrers, isLoading: loadingReferrers } = useWpReferrers();
  const { data: searchEngines, isLoading: loadingSearch } = useWpSearch();
  const { data: countries, isLoading: loadingCountries } = useWpCountries();
  const { data: platforms, isLoading: loadingPlatforms } = useWpPlatforms();
  const { data: online, isLoading: loadingOnline } = useWpOnline();
  const { data: hits, isLoading: loadingHits } = useWpHits();
  const { data: visitors, isLoading: loadingVisitors } = useWpVisitors();

  const onlineCount = typeof online === "number" ? online : Array.isArray(online) ? online.length : online?.count ?? online?.online ?? undefined;

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
      {summary && <SummaryCards summary={summary} onlineCount={onlineCount} />}

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tendance des visites
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHits ? <Spinner /> : <TrendChart hitsData={hits} visitorsData={visitors} />}
        </CardContent>
      </Card>

      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pages" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Pages</TabsTrigger>
          <TabsTrigger value="referrers" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Sources</TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5"><Search className="h-3.5 w-3.5" />Recherche</TabsTrigger>
          <TabsTrigger value="browsers" className="gap-1.5"><Monitor className="h-3.5 w-3.5" />Navigateurs</TabsTrigger>
          <TabsTrigger value="platforms" className="gap-1.5"><Smartphone className="h-3.5 w-3.5" />Plateformes</TabsTrigger>
          <TabsTrigger value="countries" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />Pays</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pages les plus vues</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPages ? <Spinner /> : errorPages ? <ErrorState message="Erreur chargement pages" /> : (
                <DataTable
                  data={pages}
                  columns={[
                    { key: "title", label: "Page", render: (r) => r.title || r.uri || r.page || "—" },
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
              <CardTitle className="text-base">Sources de trafic</CardTitle>
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
              <CardTitle className="text-base">Moteurs de recherche</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSearch ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(searchEngines) ? searchEngines : searchEngines ? Object.entries(searchEngines).map(([name, val]) => ({ name, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "name", label: "Moteur", render: (r) => r.engine || r.name || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || 0 },
                    ]}
                  />
                  <PieChartCard data={searchEngines} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="browsers">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Navigateurs</CardTitle>
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

        <TabsContent value="platforms">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Systèmes d'exploitation</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPlatforms ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(platforms) ? platforms : platforms ? Object.entries(platforms).map(([name, val]) => ({ name, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "name", label: "Plateforme", render: (r) => r.platform || r.name || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || r.value || 0 },
                    ]}
                  />
                  <PieChartCard data={platforms} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="countries">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pays des visiteurs</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCountries ? <Spinner /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DataTable
                    data={Array.isArray(countries) ? countries : countries ? Object.entries(countries).map(([name, val]) => ({ name, count: typeof val === "number" ? val : (val as any)?.count || 0 })) : []}
                    columns={[
                      { key: "name", label: "Pays", render: (r) => r.country || r.name || r.location || "—" },
                      { key: "count", label: "Visites", align: "right", render: (r) => r.count || r.hits || r.flag ? `${r.flag || ""} ${r.count || 0}` : r.count || 0 },
                    ]}
                  />
                  <PieChartCard data={countries} />
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
