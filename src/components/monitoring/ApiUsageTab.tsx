import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Bot,
  CircleDollarSign,
  Clock,
  Cpu,
  Flame,
  Zap,
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
import { rpc, type ApiUsageDailyRow, type ApiUsageTopCall } from "@/lib/supabase-rpc";

type Period = "7" | "30" | "90";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "hsl(25, 75%, 55%)",
  openai: "hsl(160, 55%, 45%)",
  assemblyai: "hsl(265, 60%, 60%)",
  lovable: "hsl(210, 70%, 55%)",
  gemini: "hsl(200, 65%, 50%)",
};

const TRIGGER_LABELS: Record<string, string> = {
  user: "Utilisateur",
  cron: "Cron",
  webhook: "Webhook",
  trigger: "Trigger DB",
  unknown: "Inconnu",
};

const chartConfig = {
  cost: { label: "Coût (USD)", color: "hsl(var(--primary))" },
};

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString("fr-FR")}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Somme d'une métrique sur un sous-ensemble de lignes. */
function sum<K extends keyof ApiUsageDailyRow>(rows: ApiUsageDailyRow[], key: K): number {
  return rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
}

const ApiUsageTab = () => {
  const [period, setPeriod] = useState<Period>("30");
  const [provider, setProvider] = useState<string>("all");

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["api-usage-daily", period],
    queryFn: async () => {
      const { data, error } = await rpc.getApiUsageDaily(Number(period));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: topCalls = [] } = useQuery({
    queryKey: ["api-usage-top-calls", period],
    queryFn: async () => {
      const { data, error } = await rpc.getApiUsageTopCalls(Number(period), 15);
      if (error) throw error;
      return data || [];
    },
  });

  const providers = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.provider))).sort(),
    [allRows],
  );

  const rows = useMemo(
    () => (provider === "all" ? allRows : allRows.filter((r) => r.provider === provider)),
    [allRows, provider],
  );

  // ── KPIs ───────────────────────────────────────────────────
  const totalCost = sum(rows, "cost_usd");
  const totalCalls = sum(rows, "calls");
  const totalErrors = sum(rows, "errors");
  const dayCount = useMemo(() => new Set(rows.map((r) => r.day)).size, [rows]);
  const avgCostPerDay = dayCount > 0 ? totalCost / dayCount : 0;
  const cronCost = sum(rows.filter((r) => r.trigger_source !== "user"), "cost_usd");
  const cronShare = totalCost > 0 ? (cronCost / totalCost) * 100 : 0;
  const cacheRead = sum(rows, "cache_read_tokens");
  const cacheRate =
    cacheRead + sum(rows, "input_tokens") > 0
      ? (cacheRead / (cacheRead + sum(rows, "input_tokens"))) * 100
      : 0;

  // ── Coût par jour, empilé par provider ─────────────────────
  const dailyByProvider = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const entry = byDay.get(r.day) ?? {};
      entry[r.provider] = (entry[r.provider] ?? 0) + Number(r.cost_usd);
      byDay.set(r.day, entry);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, costs]) => ({
        date: format(parseISO(day), "d MMM", { locale: fr }),
        fullDate: format(parseISO(day), "EEEE d MMMM", { locale: fr }),
        total: Object.values(costs).reduce((a, b) => a + b, 0),
        ...costs,
      }));
  }, [rows]);

  const visibleProviders = useMemo(
    () => Array.from(new Set(rows.map((r) => r.provider))).sort(),
    [rows],
  );

  // ── Origines classées par coût ─────────────────────────────
  interface OriginStat {
    origin: string;
    provider: string;
    cost: number;
    calls: number;
    errors: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    audioSeconds: number;
    triggers: Set<string>;
  }

  const originStats = useMemo(() => {
    const map = new Map<string, OriginStat>();
    for (const r of rows) {
      const stat = map.get(r.origin) ?? {
        origin: r.origin,
        provider: r.provider,
        cost: 0,
        calls: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        audioSeconds: 0,
        triggers: new Set<string>(),
      };
      stat.cost += Number(r.cost_usd);
      stat.calls += Number(r.calls);
      stat.errors += Number(r.errors);
      stat.inputTokens += Number(r.input_tokens);
      stat.outputTokens += Number(r.output_tokens);
      stat.cacheReadTokens += Number(r.cache_read_tokens);
      stat.audioSeconds += Number(r.audio_seconds);
      stat.triggers.add(r.trigger_source);
      map.set(r.origin, stat);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  const topOrigins = useMemo(
    () =>
      originStats.slice(0, 12).map((s) => ({
        name: s.origin,
        cost: Number(s.cost.toFixed(4)),
        provider: s.provider,
      })),
    [originStats],
  );

  // ── Répartition par déclencheur ────────────────────────────
  const triggerStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.trigger_source, (map.get(r.trigger_source) ?? 0) + Number(r.cost_usd));
    }
    return Array.from(map.entries())
      .map(([name, cost]) => ({ name: TRIGGER_LABELS[name] ?? name, cost }))
      .sort((a, b) => b.cost - a.cost);
  }, [rows]);

  // ── Modèles ────────────────────────────────────────────────
  const modelStats = useMemo(() => {
    const map = new Map<string, { model: string; cost: number; calls: number }>();
    for (const r of rows) {
      const key = r.model || "(n/a)";
      const stat = map.get(key) ?? { model: key, cost: 0, calls: 0 };
      stat.cost += Number(r.cost_usd);
      stat.calls += Number(r.calls);
      map.set(key, stat);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  if (!isLoading && allRows.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <CircleDollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Aucune consommation enregistrée sur cette période.</p>
            <p className="text-sm mt-2">
              Les appels aux APIs payantes sont tracés depuis le déploiement des edge functions
              instrumentées. Les données apparaissent au premier appel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex justify-end gap-2">
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <CircleDollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coût total</p>
                <p className="text-2xl font-bold">{formatUsd(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moy. / jour</p>
                <p className="text-2xl font-bold">{formatUsd(avgCostPerDay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Part automatique</p>
                <p className="text-2xl font-bold">{cronShare.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">
                  crons, webhooks et triggers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appels</p>
                <p className="text-2xl font-bold">{totalCalls.toLocaleString("fr-FR")}</p>
                {totalErrors > 0 && (
                  <p className="text-xs text-destructive">{totalErrors} en erreur</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coût par jour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Coût par jour, par provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={dailyByProvider} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatUsd(Number(v))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [`${formatUsd(Number(value))} `, String(name)]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visibleProviders.map((p) => (
                <Bar
                  key={p}
                  dataKey={p}
                  stackId="cost"
                  fill={PROVIDER_COLORS[p] ?? "hsl(var(--primary))"}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top origines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Origines les plus coûteuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart
                data={topOrigins}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatUsd(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={180}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => [formatUsd(Number(value)), "Coût"]} />
                  }
                />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                  {topOrigins.map((o) => (
                    <Cell
                      key={o.name}
                      fill={PROVIDER_COLORS[o.provider] ?? "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Par déclencheur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {triggerStats.map((t) => (
              <div key={t.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{t.name}</span>
                  <span className="font-medium">{formatUsd(t.cost)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${totalCost > 0 ? (t.cost / totalCost) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Tokens lus en cache</span>
                <span>{cacheRate.toFixed(0)}%</span>
              </div>
              <p className="text-xs mt-1">
                Un taux bas sur Anthropic signale un préfixe de prompt instable.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détail par origine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Détail par origine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origine</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Déclencheurs</TableHead>
                  <TableHead className="text-right">Appels</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right">Coût / appel</TableHead>
                  <TableHead className="text-right">% total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {originStats.map((s) => (
                  <TableRow key={s.origin}>
                    <TableCell className="font-mono text-sm">
                      {s.origin}
                      {s.errors > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {s.errors}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {s.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Array.from(s.triggers)
                        .map((t) => TRIGGER_LABELS[t] ?? t)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="text-right">{s.calls.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {s.audioSeconds > 0
                        ? `${Math.round(s.audioSeconds / 60)} min audio`
                        : `${formatCompact(s.inputTokens)} / ${formatCompact(s.outputTokens)}`}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatUsd(s.cost)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatUsd(s.calls > 0 ? s.cost / s.calls : 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {totalCost > 0 ? ((s.cost / totalCost) * 100).toFixed(1) : "0"}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modèles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Par modèle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modèle</TableHead>
                <TableHead className="text-right">Appels</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">% total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelStats.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-mono text-sm">{m.model}</TableCell>
                  <TableCell className="text-right">{m.calls.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right font-medium">{formatUsd(m.cost)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {totalCost > 0 ? ((m.cost / totalCost) * 100).toFixed(1) : "0"}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Appels unitaires les plus chers */}
      {topCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Appels unitaires les plus coûteux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Origine</TableHead>
                    <TableHead>Opération</TableHead>
                    <TableHead>Modèle</TableHead>
                    <TableHead className="text-right">Tokens in / out</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead className="text-right">Coût</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topCalls as ApiUsageTopCall[]).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(c.created_at), "d MMM HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{c.origin}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.operation || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.model || "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCompact(c.input_tokens)} / {formatCompact(c.output_tokens)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {c.duration_ms ? `${(c.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatUsd(Number(c.cost_usd))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApiUsageTab;
