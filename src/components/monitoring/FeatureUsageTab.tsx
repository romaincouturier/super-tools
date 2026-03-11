import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart3,
  MousePointerClick,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface FeatureUsageRow {
  id: string;
  feature_name: string;
  feature_category: string;
  created_at: string;
}

type Period = "7" | "30" | "90";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(160, 55%, 45%)",
  "hsl(30, 70%, 55%)",
  "hsl(190, 60%, 50%)",
  "hsl(50, 65%, 50%)",
];

const chartConfig = {
  count: {
    label: "Utilisations",
    color: "hsl(var(--primary))",
  },
};

const FeatureUsageTab = () => {
  const [period, setPeriod] = useState<Period>("30");

  const since = useMemo(
    () => subDays(new Date(), Number(period)).toISOString(),
    [period],
  );

  const { data: rows = [] } = useQuery({
    queryKey: ["feature-usage", period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feature_usage")
        .select("id, feature_name, feature_category, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FeatureUsageRow[];
    },
  });

  // KPIs
  const totalEvents = rows.length;
  const uniqueFeatures = useMemo(
    () => new Set(rows.map((r) => r.feature_name)).size,
    [rows],
  );
  const uniqueCategories = useMemo(
    () => new Set(rows.map((r) => r.feature_category)).size,
    [rows],
  );

  // By category
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.feature_category] = (counts[r.feature_category] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  // By feature
  const featureData = useMemo(() => {
    const counts: Record<string, { count: number; category: string }> = {};
    for (const r of rows) {
      if (!counts[r.feature_name]) {
        counts[r.feature_name] = { count: 0, category: r.feature_category };
      }
      counts[r.feature_name].count++;
    }
    return Object.entries(counts)
      .map(([name, { count, category }]) => ({ name, count, category }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  // Daily timeline
  const dailyData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const day = format(parseISO(r.created_at), "yyyy-MM-dd");
      counts[day] = (counts[day] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({
        date: format(parseISO(day), "d MMM", { locale: fr }),
        fullDate: format(parseISO(day), "d MMMM yyyy", { locale: fr }),
        count,
      }));
  }, [rows]);

  const avgPerDay = dailyData.length > 0
    ? Math.round(totalEvents / dailyData.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MousePointerClick className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Événements</p>
                <p className="text-2xl font-bold">{totalEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Features</p>
                <p className="text-2xl font-bold">{uniqueFeatures}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Catégories</p>
                <p className="text-2xl font-bold">{uniqueCategories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moy. / jour</p>
                <p className="text-2xl font-bold">{avgPerDay}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Utilisation par jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MousePointerClick className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune donnée d'usage sur cette période.</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value}`, "Événements"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
                    />
                  }
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value}`, "Événements"]}
                    />
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Feature table */}
      {featureData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              Détail par feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Utilisations</TableHead>
                  <TableHead className="text-right">% du total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {featureData.slice(0, 30).map((f) => {
                  const percent =
                    totalEvents > 0
                      ? ((f.count / totalEvents) * 100).toFixed(1)
                      : "0";
                  return (
                    <TableRow key={f.name}>
                      <TableCell className="font-mono text-sm">{f.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {f.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{f.count}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {percent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {featureData.length > 30 && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                + {featureData.length - 30} autres features
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FeatureUsageTab;
