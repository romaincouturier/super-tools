import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Database,
  HardDrive,
  Table2,
  TrendingUp,
  Calendar,
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
import { supabase } from "@/integrations/supabase/client";

interface DbSizeSnapshot {
  id: string;
  snapshot_date: string;
  total_size_bytes: number;
  table_sizes: Record<string, number> | null;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "Ko", "Mo", "Go", "To"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}

const chartConfig = {
  sizeMb: {
    label: "Taille (Mo)",
    color: "hsl(var(--primary))",
  },
};

const DbSizeTab = () => {
  const { data: snapshots = [] } = useQuery({
    queryKey: ["db-size-snapshots"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("db_size_snapshots")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as DbSizeSnapshot[];
    },
  });

  const { data: liveSize } = useQuery({
    queryKey: ["db-live-size"],
    queryFn: async () => {
      const { data, error } = await rpc.getDbSize();
      if (error) throw error;
      return data!
    },
    refetchInterval: 60000,
  });

  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        date: format(parseISO(s.created_at), "d MMM HH'h'", { locale: fr }),
        fullDate: format(parseISO(s.created_at), "d MMMM yyyy à HH'h'mm", { locale: fr }),
        sizeMb: +(s.total_size_bytes / (1024 * 1024)).toFixed(2),
        sizeBytes: s.total_size_bytes,
      })),
    [snapshots]
  );

  const tableSizes = useMemo(() => {
    const raw = liveSize?.table_sizes || snapshots[snapshots.length - 1]?.table_sizes || {};
    return Object.entries(raw)
      .map(([name, bytes]) => ({
        name: name.replace("public.", ""),
        bytes: bytes as number,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [liveSize, snapshots]);

  const currentSize = liveSize?.total_size_bytes || snapshots[snapshots.length - 1]?.total_size_bytes || 0;
  const firstSnapshot = snapshots[0];
  const growth = snapshots.length > 1 ? currentSize - firstSnapshot.total_size_bytes : 0;
  const growthPercent =
    firstSnapshot && firstSnapshot.total_size_bytes > 0
      ? ((growth / firstSnapshot.total_size_bytes) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taille actuelle</p>
                <p className="text-2xl font-bold">{formatBytes(currentSize)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Croissance</p>
                <p className="text-2xl font-bold">
                  {growth >= 0 ? "+" : ""}
                  {formatBytes(Math.abs(growth))}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({growthPercent}%)
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Table2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tables</p>
                <p className="text-2xl font-bold">{tableSizes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Évolution de la taille de la base
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun historique disponible.</p>
              <p className="text-sm mt-1">
                Les snapshots sont enregistrés automatiquement toutes les heures.
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} Mo`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value} Mo`, "Taille"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="sizeMb"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorSize)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Table breakdown */}
      {tableSizes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Répartition par table
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Taille</TableHead>
                  <TableHead className="text-right">% du total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableSizes.slice(0, 20).map((t) => {
                  const percent =
                    currentSize > 0 ? ((t.bytes / currentSize) * 100).toFixed(1) : "0";
                  return (
                    <TableRow key={t.name}>
                      <TableCell className="font-mono text-sm">{t.name}</TableCell>
                      <TableCell className="text-right">{formatBytes(t.bytes)}</TableCell>
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
            {tableSizes.length > 20 && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                + {tableSizes.length - 20} autres tables
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DbSizeTab;
