import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import {
  eachDayOfInterval,
  format,
  isWeekend,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart3,
  CalendarCheck,
  MousePointerClick,
  Layers,
  TrendingUp,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  trend: {
    label: "Moyenne 7 jours",
    color: "hsl(var(--muted-foreground))",
  },
};

/**
 * `page_view` représente à lui seul ~94% des événements : mélangé aux actions
 * métier il rend le graphe journalier illisible. Le filtre par défaut l'écarte
 * pour laisser voir ce qui est réellement utilisé.
 */
const NAVIGATION_CATEGORY = "navigation";

type Scope = "actions" | "all";

const FeatureUsageTab = () => {
  const [period, setPeriod] = useState<Period>("30");
  const [scope, setScope] = useState<Scope>("actions");

  const since = useMemo(
    () => subDays(new Date(), Number(period)).toISOString(),
    [period],
  );

  const { data: rows = [] } = useQuery({
    queryKey: ["feature-usage", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_usage")
        .select("id, feature_name, feature_category, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FeatureUsageRow[];
    },
  });

  // Les vues de page noient tout le reste : le graphe journalier et les KPI
  // travaillent par défaut sur les seules actions métier.
  const scopedRows = useMemo(
    () =>
      scope === "all"
        ? rows
        : rows.filter((r) => r.feature_category !== NAVIGATION_CATEGORY),
    [rows, scope],
  );

  // KPIs
  const totalEvents = scopedRows.length;
  const uniqueFeatures = useMemo(
    () => new Set(scopedRows.map((r) => r.feature_name)).size,
    [scopedRows],
  );
  const uniqueCategories = useMemo(
    () => new Set(scopedRows.map((r) => r.feature_category)).size,
    [scopedRows],
  );

  // By category — toujours sur l'ensemble, c'est là que la comparaison
  // navigation / métier a du sens.
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
    for (const r of scopedRows) {
      if (!counts[r.feature_name]) {
        counts[r.feature_name] = { count: 0, category: r.feature_category };
      }
      counts[r.feature_name].count++;
    }
    return Object.entries(counts)
      .map(([name, { count, category }]) => ({ name, count, category }))
      .sort((a, b) => b.count - a.count);
  }, [scopedRows]);

  // Catégories présentes dans le graphe empilé, les plus volumineuses d'abord.
  const stackedCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of scopedRows) {
      counts[r.feature_category] = (counts[r.feature_category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }, [scopedRows]);

  /**
   * Timeline journalière. Trois corrections par rapport à un simple group by :
   * - les jours sans événement sont matérialisés (sinon un week-end mort
   *   disparaît du graphe et la série paraît continue) ;
   * - les barres sont empilées par catégorie ;
   * - une moyenne glissante 7 jours donne la tendance, que le bruit
   *   quotidien masque complètement.
   */
  const dailyData = useMemo(() => {
    const counts = new Map<string, Record<string, number>>();
    for (const r of scopedRows) {
      const day = format(parseISO(r.created_at), "yyyy-MM-dd");
      const entry = counts.get(day) ?? {};
      entry[r.feature_category] = (entry[r.feature_category] ?? 0) + 1;
      counts.set(day, entry);
    }

    const end = startOfDay(new Date());
    const start = subDays(end, Number(period) - 1);
    const days = eachDayOfInterval({ start, end });

    const base = days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const byCategory = counts.get(key) ?? {};
      const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
      return {
        key,
        date: format(d, "d MMM", { locale: fr }),
        fullDate: format(d, "EEEE d MMMM", { locale: fr }),
        weekend: isWeekend(d),
        total,
        ...byCategory,
      };
    });

    return base.map((d, i) => {
      const window = base.slice(Math.max(0, i - 6), i + 1);
      const trend = window.reduce((a, b) => a + b.total, 0) / window.length;
      return { ...d, trend: Number(trend.toFixed(1)) };
    });
  }, [scopedRows, period]);

  // Un jour est « actif » s'il a produit au moins un événement : diviser par le
  // nombre de jours calendaires écrase la moyenne, diviser par les seuls jours
  // avec données la gonfle. On affiche les deux.
  const activeDays = dailyData.filter((d) => d.total > 0).length;
  const avgPerDay = dailyData.length > 0
    ? Math.round(totalEvents / dailyData.length)
    : 0;
  const avgPerActiveDay = activeDays > 0 ? Math.round(totalEvents / activeDays) : 0;
  const busiestDay = useMemo(
    () => dailyData.reduce<(typeof dailyData)[number] | null>(
      (best, d) => (!best || d.total > best.total ? d : best),
      null,
    ),
    [dailyData],
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && setScope(v as Scope)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="actions">Actions métier</ToggleGroupItem>
          <ToggleGroupItem value="all">Tout (avec vues de page)</ToggleGroupItem>
        </ToggleGroup>
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
                <CalendarCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jours actifs</p>
                <p className="text-2xl font-bold">
                  {activeDays}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}/ {dailyData.length}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {uniqueCategories} catégorie{uniqueCategories > 1 ? "s" : ""}
                </p>
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
                <p className="text-sm text-muted-foreground">Moy. / jour actif</p>
                <p className="text-2xl font-bold">{avgPerActiveDay}</p>
                <p className="text-xs text-muted-foreground">
                  {avgPerDay} sur la période complète
                </p>
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
          <p className="text-sm text-muted-foreground">
            Barres empilées par catégorie, jours sans activité inclus, tendance en
            moyenne glissante sur 7 jours.
          </p>
        </CardHeader>
        <CardContent>
          {totalEvents === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MousePointerClick className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune donnée d'usage sur cette période.</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [`${value} `, String(name)]}
                      labelFormatter={(_, payload) => {
                        const point = payload?.[0]?.payload;
                        if (!point) return "";
                        return point.weekend ? `${point.fullDate} (week-end)` : point.fullDate;
                      }}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {stackedCategories.map((category, i) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="events"
                    fill={COLORS[i % COLORS.length]}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Moyenne 7 j"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          )}
          {busiestDay && busiestDay.total > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Pic d'activité le {busiestDay.fullDate} : {busiestDay.total} événements.
            </p>
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
