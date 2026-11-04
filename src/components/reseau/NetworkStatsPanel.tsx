import {
  BarChart3,
  Heart,
  CheckCircle2,
  TrendingUp,
  Clock,
  UserX,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { NetworkStats } from "@/types/reseau";

interface NetworkStatsPanelProps {
  stats: NetworkStats;
}

const NetworkStatsPanel = ({ stats }: NetworkStatsPanelProps) => {
  const healthColor =
    stats.networkHealthScore >= 70
      ? "text-success"
      : stats.networkHealthScore >= 40
        ? "text-caution-ink"
        : "text-danger-ink";

  const healthBg =
    stats.networkHealthScore >= 70
      ? "bg-success-surface"
      : stats.networkHealthScore >= 40
        ? "bg-caution-surface"
        : "bg-danger-surface";

  const maxWeekly = Math.max(...stats.weeklyActivity.map((w) => w.count), 1);

  return (
    <div className="space-y-4">
      {/* Health Score + Key KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${healthBg} mb-2`}>
              <Heart className={`h-6 w-6 ${healthColor}`} />
            </div>
            <p className={`text-2xl font-bold ${healthColor}`}>{stats.networkHealthScore}</p>
            <p className="text-xs text-muted-foreground">Score santé</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-info-surface mb-2">
              <Activity className="h-6 w-6 text-info-ink" />
            </div>
            <p className="text-2xl font-bold text-info-ink">{stats.interactionsLast7d}</p>
            <p className="text-xs text-muted-foreground">Interactions (7j)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-surface mb-2">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{stats.completionRate}%</p>
            <p className="text-xs text-muted-foreground">Taux complétion</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-info-surface mb-2">
              <Clock className="h-6 w-6 text-info-ink" />
            </div>
            <p className="text-2xl font-bold text-info-ink">{stats.averageDaysSinceContact}j</p>
            <p className="text-xs text-muted-foreground">Moy. sans contact</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Warmth distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Répartition chaleur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Chauds</span>
                <span className="text-danger-ink font-medium">
                  {stats.warmthDistribution.hot} ({stats.warmthPercent.hot}%)
                </span>
              </div>
              <Progress value={stats.warmthPercent.hot} className="h-2 [&>div]:bg-danger" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Tièdes</span>
                <span className="text-caution-ink font-medium">
                  {stats.warmthDistribution.warm} ({stats.warmthPercent.warm}%)
                </span>
              </div>
              <Progress value={stats.warmthPercent.warm} className="h-2 [&>div]:bg-caution" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Froids</span>
                <span className="text-info-ink font-medium">
                  {stats.warmthDistribution.cold} ({stats.warmthPercent.cold}%)
                </span>
              </div>
              <Progress value={stats.warmthPercent.cold} className="h-2 [&>div]:bg-info" />
            </div>
            {stats.contactsNeverContacted > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <UserX className="h-3.5 w-3.5" />
                {stats.contactsNeverContacted} contact{stats.contactsNeverContacted > 1 ? "s" : ""} jamais contacté{stats.contactsNeverContacted > 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly activity chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Activité hebdomadaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-24">
              {stats.weeklyActivity.map((w) => (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-micro text-muted-foreground">{w.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${(w.count / maxWeekly) * 100}%` }}
                  />
                  <span className="text-micro text-muted-foreground truncate w-full text-center">
                    {w.week}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 pt-2 border-t">
              <span>{stats.interactionsLast30d} interactions (30j)</span>
              <span>{stats.totalInteractions} total</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions summary */}
      {stats.totalActions > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-success font-medium">{stats.actionsDone} faites</span>
                <span className="text-muted-foreground">{stats.actionsSkipped} passées</span>
                <span className="text-primary font-medium">{stats.actionsPending} en cours</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.totalActions} actions au total
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NetworkStatsPanel;
