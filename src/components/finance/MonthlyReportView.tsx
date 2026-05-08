import { forwardRef } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Target, Wallet, Users, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EUR } from "@/components/finance/InvoicesTable";
import type { MonthlyReportPayload } from "@/hooks/useMonthlyReport";

interface MonthlyReportViewProps {
  payload: MonthlyReportPayload;
}

function formatLongMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function pctLabel(current: number, previous: number): string {
  if (previous === 0) return "—";
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

interface SparklineKpiProps {
  title: string;
  value: string;
  delta: string;
  deltaPositive: boolean | null;
  icon: React.ComponentType<{ className?: string }>;
}

function SparklineKpi({ title, value, delta, deltaPositive, icon: Icon }: SparklineKpiProps) {
  const deltaClass =
    deltaPositive === null
      ? "text-muted-foreground"
      : deltaPositive
        ? "text-emerald-600"
        : "text-rose-600";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <div className={`text-xs ${deltaClass}`}>{delta} vs mois précédent</div>
      </CardContent>
    </Card>
  );
}

const MonthlyReportView = forwardRef<HTMLDivElement, MonthlyReportViewProps>(({ payload }, ref) => {
  return (
    <div ref={ref} className="bg-background p-8 space-y-6">
      <header className="border-b pb-4 space-y-1">
        <h1 className="text-2xl font-bold">Rapport de pilotage — {formatLongMonth(payload.month)}</h1>
        {payload.company_name && <p className="text-sm text-muted-foreground">{payload.company_name}</p>}
        <p className="text-xs text-muted-foreground">
          Généré le {new Date(payload.generated_at).toLocaleDateString("fr-FR")}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Résumé dirigeant
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SparklineKpi
            title="CA encaissé"
            value={EUR.format(payload.revenue)}
            delta={pctLabel(payload.revenue, payload.revenue_previous)}
            deltaPositive={payload.revenue >= payload.revenue_previous}
            icon={TrendingUp}
          />
          <SparklineKpi
            title="Résultat net"
            value={EUR.format(payload.net_result)}
            delta={pctLabel(payload.net_result, payload.net_result_previous)}
            deltaPositive={payload.net_result >= payload.net_result_previous}
            icon={Target}
          />
          <SparklineKpi
            title="Taux de marge"
            value={`${payload.margin_rate.toFixed(1)} %`}
            delta={`${(payload.margin_rate - payload.margin_rate_previous).toFixed(1)} pts`}
            deltaPositive={payload.margin_rate >= payload.margin_rate_previous}
            icon={Wallet}
          />
          <SparklineKpi
            title="Clients actifs"
            value={String(payload.active_customers)}
            delta={`Panier moy. ${EUR.format(payload.avg_basket)}`}
            deltaPositive={null}
            icon={Users}
          />
          <SparklineKpi
            title="Deals gagnés"
            value={String(payload.deals_won_count)}
            delta={EUR.format(payload.deals_won_value)}
            deltaPositive={null}
            icon={Briefcase}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Évolution 12 mois</h2>
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={payload.monthly_series}>
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="CA"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                  name="Charges"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Ce mois</h2>
        {payload.highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas de fait marquant détecté.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {payload.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Mois prochain</h2>
        <Card>
          <CardContent className="pt-4">
            {payload.pipeline_next_month_count === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune opportunité avec une date de closing prévisionnelle.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline du mois suivant</div>
                  <div className="text-xl font-bold">{payload.pipeline_next_month_count} opportunité(s)</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Valeur estimée</div>
                  <div className="text-xl font-bold tabular-nums">
                    {EUR.format(payload.pipeline_next_month_value)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="text-xs text-muted-foreground pt-4 border-t flex items-center justify-between">
        <span>SuperTools — Pilotage Pennylane × CRM</span>
        <span className="flex items-center gap-1">
          {payload.net_result < 0 && <TrendingDown className="h-3 w-3 text-rose-600" />}
          Résultat : {EUR.format(payload.net_result)}
        </span>
      </footer>
    </div>
  );
});

MonthlyReportView.displayName = "MonthlyReportView";

export default MonthlyReportView;
