import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { useDailyActionsPerUser } from "@/hooks/useDailyActionsPerUser";

const PALETTE = [
  "#101820",
  "#ffd100",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#6366f1",
  "#94a3b8",
];

function formatWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const DailyActionsPerUserChart = () => {
  const { data, isLoading } = useDailyActionsPerUser(true);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Spinner />
      </div>
    );
  }
  if (!data || data.weeks.length === 0) return null;

  const chartConfig: ChartConfig = {};
  data.people.forEach((name, i) => {
    chartConfig[name] = { label: name, color: PALETTE[i % PALETTE.length] };
  });

  const points = data.weeks.map((w) => ({ ...w, week: formatWeek(w.week) }));

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <BarChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.people.map((name, i) => (
          <Bar
            key={name}
            dataKey={name}
            stackId="actions"
            fill={PALETTE[i % PALETTE.length]}
            radius={i === data.people.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
};

export default DailyActionsPerUserChart;
