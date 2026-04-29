import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ZAxis,
  Legend,
} from "recharts";
import { format, eachDayOfInterval, startOfDay, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import type { KanbanColumnDef, KanbanStatsItem } from "@/types/kanban";

interface KanbanStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumnDef[];
  items: KanbanStatsItem[];
  /** Column IDs considered as "done" for cycle time calculation. */
  doneColumnIds?: string[];
  /** Column IDs representing "won" outcomes (shown in green on CFD). */
  wonColumnIds?: string[];
  /** Column IDs representing "lost" outcomes (shown in red on CFD). */
  lostColumnIds?: string[];
}

const CHART_COLORS = [
  "#6b7280", "#3b82f6", "#f59e0b", "#22c55e", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

/**
 * Build cumulative flow diagram data.
 * For each day, count how many items exist in each column
 * (an item "exists" if its created_at <= that day, and it's assigned to a column).
 *
 * Since we don't have full move history, we use a simplified model:
 * items are counted in their CURRENT column from their creation date onward.
 */
function buildCFDData(
  items: KanbanStatsItem[],
  columns: KanbanColumnDef[],
): Array<Record<string, unknown>> {
  if (items.length === 0) return [];

  const dates = items.map((i) => new Date(i.createdAt).getTime());
  const minDate = startOfDay(new Date(Math.min(...dates)));
  const maxDate = startOfDay(new Date());

  if (differenceInCalendarDays(maxDate, minDate) > 365) {
    // Cap to last 365 days
    const cappedMin = new Date(maxDate);
    cappedMin.setDate(cappedMin.getDate() - 365);
    return buildCFDForRange(items, columns, cappedMin, maxDate);
  }

  return buildCFDForRange(items, columns, minDate, maxDate);
}

function buildCFDForRange(
  items: KanbanStatsItem[],
  columns: KanbanColumnDef[],
  minDate: Date,
  maxDate: Date,
): Array<Record<string, unknown>> {
  const days = eachDayOfInterval({ start: minDate, end: maxDate });
  const sortedCols = [...columns].sort((a, b) => a.position - b.position);

  return days.map((day) => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const row: Record<string, unknown> = {
      date: format(day, "dd/MM", { locale: fr }),
      _raw: day,
    };

    // Count items that existed by this day, grouped by their current column
    for (const col of sortedCols) {
      const count = items.filter(
        (item) =>
          item.columnId === col.id &&
          new Date(item.createdAt) <= dayEnd,
      ).length;
      row[col.id] = count;
    }

    return row;
  });
}

/**
 * Build control chart data: cycle time per completed item.
 */
function buildControlChartData(
  items: KanbanStatsItem[],
  doneColumnIds: string[],
): { points: Array<{ name: string; cycleTime: number; date: number }>; mean: number; ucl: number; lcl: number } {
  const completedItems = items.filter(
    (item) =>
      doneColumnIds.includes(item.columnId) && item.completedAt,
  );

  const points = completedItems
    .map((item) => {
      const created = new Date(item.createdAt);
      const completed = new Date(item.completedAt!);
      const cycleTime = differenceInCalendarDays(completed, created);
      return {
        name: format(completed, "dd/MM", { locale: fr }),
        cycleTime: Math.max(cycleTime, 0),
        date: completed.getTime(),
      };
    })
    .sort((a, b) => a.date - b.date);

  if (points.length === 0) {
    return { points: [], mean: 0, ucl: 0, lcl: 0 };
  }

  const mean = points.reduce((s, p) => s + p.cycleTime, 0) / points.length;
  const variance = points.reduce((s, p) => s + (p.cycleTime - mean) ** 2, 0) / points.length;
  const stdDev = Math.sqrt(variance);
  const ucl = mean + 2 * stdDev;
  const lcl = Math.max(0, mean - 2 * stdDev);

  return { points, mean, ucl, lcl };
}

const WON_COLOR = "#22c55e";
const LOST_COLOR = "#ef4444";

export default function KanbanStatsDialog({
  open,
  onOpenChange,
  columns,
  items,
  doneColumnIds,
  wonColumnIds = [],
  lostColumnIds = [],
}: KanbanStatsDialogProps) {
  const sortedCols = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  // For CFD stacking: reverse so early pipeline stages sit on top (standard CFD convention)
  const reversedCols = useMemo(() => [...sortedCols].reverse(), [sortedCols]);

  const resolvedDoneIds = useMemo(() => {
    if (doneColumnIds && doneColumnIds.length > 0) return doneColumnIds;
    // Default: last column is "done"
    return sortedCols.length > 0 ? [sortedCols[sortedCols.length - 1].id] : [];
  }, [doneColumnIds, sortedCols]);

  const cfdData = useMemo(() => buildCFDData(items, columns), [items, columns]);
  const controlChart = useMemo(
    () => buildControlChartData(items, resolvedDoneIds),
    [items, resolvedDoneIds],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statistiques du tableau</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cfd" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="cfd" className="flex-1">Flux cumulé</TabsTrigger>
            <TabsTrigger value="control" className="flex-1">Carte de contrôle</TabsTrigger>
          </TabsList>

          <TabsContent value="cfd" className="mt-4">
            {cfdData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Pas encore de données pour le diagramme de flux cumulé.
              </p>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cfdData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {reversedCols.map((col) => {
                      const isWon = wonColumnIds.includes(col.id);
                      const isLost = lostColumnIds.includes(col.id);
                      const originalIndex = sortedCols.findIndex((c) => c.id === col.id);
                      const color = isWon
                        ? WON_COLOR
                        : isLost
                          ? LOST_COLOR
                          : col.color || CHART_COLORS[originalIndex % CHART_COLORS.length];
                      return (
                        <Area
                          key={col.id}
                          type="monotone"
                          dataKey={col.id}
                          name={col.name}
                          stackId="1"
                          stroke={color}
                          fill={color}
                          fillOpacity={isWon || isLost ? 0.75 : 0.6}
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Le diagramme de flux cumulé montre l'évolution du nombre d'éléments par colonne au fil du temps.
            </p>
          </TabsContent>

          <TabsContent value="control" className="mt-4">
            {controlChart.points.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun élément terminé pour calculer les temps de cycle.
              </p>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart data={controlChart.points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      name="Date"
                    />
                    <YAxis
                      dataKey="cycleTime"
                      tick={{ fontSize: 11 }}
                      name="Cycle (jours)"
                      label={{ value: "jours", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                    />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number) => [`${value} jours`, "Temps de cycle"]}
                    />
                    <Legend verticalAlign="top" height={30} />
                    <ReferenceLine
                      y={controlChart.mean}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      label={{ value: `Moy: ${controlChart.mean.toFixed(1)}j`, position: "right", fill: "#3b82f6", fontSize: 11 }}
                    />
                    <ReferenceLine
                      y={controlChart.ucl}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{ value: `UCL: ${controlChart.ucl.toFixed(1)}j`, position: "right", fill: "#ef4444", fontSize: 11 }}
                    />
                    {controlChart.lcl > 0 && (
                      <ReferenceLine
                        y={controlChart.lcl}
                        stroke="#22c55e"
                        strokeDasharray="5 5"
                        label={{ value: `LCL: ${controlChart.lcl.toFixed(1)}j`, position: "right", fill: "#22c55e", fontSize: 11 }}
                      />
                    )}
                    <Scatter
                      name="Temps de cycle"
                      data={controlChart.points}
                      fill="#3b82f6"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              La carte de contrôle montre le temps de cycle de chaque élément terminé, avec la moyenne et les limites de contrôle (2 écarts-types).
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
