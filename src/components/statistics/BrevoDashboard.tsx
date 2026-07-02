import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Send, MailOpen, MousePointerClick, AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBrevoOverview, type BrevoCampaign } from "@/hooks/useBrevoStatistics";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { PERIOD_LABELS, periodToRange, formatPeriodLabel, type Period } from "./statsPeriods";

const fmtNum = (v: number) => v.toLocaleString("fr-FR");
const rate = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");

function fmtSentDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="text-xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

const BrevoDashboard = () => {
  const [period, setPeriod] = useState<Period>("90d");
  const queryClient = useQueryClient();
  const { from, to } = useMemo(() => periodToRange(period), [period]);
  const periodLabel = `${PERIOD_LABELS[period]} · ${formatPeriodLabel(from, to)}`;

  const { data, isLoading, error, isFetching } = useBrevoOverview();

  const campaigns = useMemo(() => {
    const all = data?.campaigns ?? [];
    return all.filter((c) => {
      const d = (c.sentDate || "").slice(0, 10);
      return d >= from && d <= to;
    });
  }, [data, from, to]);

  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + c.sent, 0);
    const delivered = campaigns.reduce((s, c) => s + c.delivered, 0);
    const views = campaigns.reduce((s, c) => s + c.uniqueViews, 0);
    const clicks = campaigns.reduce((s, c) => s + c.uniqueClicks, 0);
    const unsub = campaigns.reduce((s, c) => s + c.unsubscriptions, 0);
    return { sent, delivered, views, clicks, unsub };
  }, [campaigns]);

  const chartData = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => (a.sentDate < b.sentDate ? -1 : 1))
        .map((c) => ({
          date: fmtSentDate(c.sentDate),
          ouvertures: c.uniqueViews,
          clics: c.uniqueClicks,
        })),
    [campaigns],
  );

  const reimport = () => queryClient.invalidateQueries({ queryKey: ["brevo-statistics"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Impossible de charger les statistiques Brevo : {(error as Error).message}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            Vérifiez que la clé API Brevo est configurée dans Paramètres → Intégrations.
          </p>
          <Button variant="outline" size="sm" className="mt-4 ml-6" onClick={reimport}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Période analysée : <span className="font-medium text-foreground">{periodLabel}</span>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={reimport} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Réimporter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Contacts" value={data?.contactsCount != null ? fmtNum(data.contactsCount) : "—"} sub="base totale" icon={Users} />
        <StatCard label="Campagnes" value={String(campaigns.length)} sub="envoyées sur la période" icon={Send} />
        <StatCard label="Emails délivrés" value={fmtNum(totals.delivered)} sub={`${fmtNum(totals.sent)} envoyés`} icon={Send} />
        <StatCard label="Taux d'ouverture" value={rate(totals.views, totals.delivered)} sub={`${fmtNum(totals.views)} ouvertures uniques`} icon={MailOpen} />
        <StatCard label="Taux de clic" value={rate(totals.clicks, totals.delivered)} sub={`${fmtNum(totals.clicks)} clics uniques`} icon={MousePointerClick} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Ouvertures et clics par campagne
            <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune campagne envoyée sur cette période</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="ouvertures" name="Ouvertures uniques" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="clics" name="Clics uniques" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Campagnes envoyées
            <span className="ml-2 text-xs font-normal text-muted-foreground">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune campagne envoyée sur cette période</p>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Campagne</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Date</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Délivrés</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Ouvertures</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Clics</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Désabo.</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: BrevoCampaign) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 max-w-[300px]">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.subject}</div>
                      </td>
                      <td className="py-1.5 pr-4 whitespace-nowrap">{fmtSentDate(c.sentDate)}</td>
                      <td className="py-1.5 pr-4 text-right">{fmtNum(c.delivered)}</td>
                      <td className="py-1.5 pr-4 text-right font-medium">{rate(c.uniqueViews, c.delivered)}</td>
                      <td className="py-1.5 pr-4 text-right">{rate(c.uniqueClicks, c.delivered)}</td>
                      <td className="py-1.5 pr-4 text-right">{fmtNum(c.unsubscriptions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrevoDashboard;
