import { Globe, Users, Eye, Monitor, Link2, Search, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWpSummary, useWpPages, useWpBrowsers, useWpReferrers } from "@/hooks/useWpStatistics";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

function SummaryCards({ summary }: { summary: Record<string, any> }) {
  const visitors = summary?.visitors ?? {};
  const visits = summary?.visits ?? {};
  const cards = [
    { label: "Aujourd'hui", visitors: visitors.today, views: visits.today, icon: Eye },
    { label: "Hier", visitors: visitors.yesterday, views: visits.yesterday, icon: Eye },
    { label: "Cette semaine", visitors: visitors.this_week ?? visitors.week, views: visits.this_week ?? visits.week, icon: Users },
    { label: "Ce mois", visitors: visitors.this_month ?? visitors.month, views: visits.this_month ?? visits.month, icon: Globe },
    { label: "Total", visitors: visitors.total, views: visits.total, icon: Globe },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-xl font-bold">{c.views ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{c.visitors ?? "—"} visiteurs</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BrowsersChart({ data }: { data: any }) {
  if (!data || !Array.isArray(data)) return null;
  const chartData = data.slice(0, 6).map((b: any) => ({
    name: b.agent || b.browser || "Autre",
    value: Number(b.count || b.hits || 0),
  })).filter((d: any) => d.value > 0);

  if (chartData.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TopPagesTable({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée</p>;
  }

  const pages = data.slice(0, 15);

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Page</th>
            <th className="py-2 text-right font-medium text-muted-foreground">Vues</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p: any, i: number) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[300px]" title={p.uri || p.page || ""}>
                {p.title || p.uri || p.page || "—"}
              </td>
              <td className="py-1.5 text-right font-medium">{p.count || p.hits || p.views || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferrersTable({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée</p>;
  }

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Source</th>
            <th className="py-2 text-right font-medium text-muted-foreground">Visites</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 15).map((r: any, i: number) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[300px]">{r.domain || r.referrer || "—"}</td>
              <td className="py-1.5 text-right font-medium">{r.count || r.hits || 0}</td>
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

const WpStatisticsDashboard = () => {
  const { data: summary, isLoading: loadingSummary, error: errorSummary } = useWpSummary();
  const { data: pages, isLoading: loadingPages, error: errorPages } = useWpPages({ per_page: "20" });
  const { data: browsers, isLoading: loadingBrowsers } = useWpBrowsers();
  const { data: referrers, isLoading: loadingReferrers } = useWpReferrers();

  const isLoading = loadingSummary;

  if (isLoading) {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Pages les plus vues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPages ? <Spinner /> : errorPages ? <ErrorState message="Erreur chargement pages" /> : <TopPagesTable data={pages} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Navigateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBrowsers ? <Spinner /> : <BrowsersChart data={browsers} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Sources de trafic
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReferrers ? <Spinner /> : <ReferrersTable data={referrers} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WpStatisticsDashboard;
