import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { OKRSnapshot } from "@/lib/okrRiskEngine";
import { MomentumData } from "@/lib/okrRiskEngine";

interface OKRExecutiveSnapshotProps {
  snapshot: OKRSnapshot;
  momentum: MomentumData[];
}

const trendConfig = {
  accelerating: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-100", label: "En accélération" },
  steady: { icon: Minus, color: "text-blue-600", bg: "bg-blue-100", label: "Stable" },
  stalling: { icon: TrendingDown, color: "text-yellow-600", bg: "bg-yellow-100", label: "Ralentissement" },
  declining: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-100", label: "En déclin" },
};

const DeltaBadge = ({ value, suffix = "pts" }: { value: number; suffix?: string }) => {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}{value}{suffix}
    </span>
  );
};

const OKRExecutiveSnapshot = ({ snapshot, momentum }: OKRExecutiveSnapshotProps) => {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Objectifs actifs</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-1">{snapshot.totalActive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Progression moy.</span>
              <DeltaBadge value={snapshot.weeklyProgressDelta} />
            </div>
            <div className="text-2xl font-bold mt-1">{snapshot.avgProgress}%</div>
            <Progress value={snapshot.avgProgress} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confiance moy.</span>
              <DeltaBadge value={snapshot.weeklyConfidenceDelta} />
            </div>
            <div className="text-2xl font-bold mt-1">{snapshot.avgConfidence}%</div>
            <Progress value={snapshot.avgConfidence} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <span className="text-sm text-muted-foreground">Statut santé</span>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{snapshot.onTrack}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">{snapshot.atRisk}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">{snapshot.behind}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wins & Risks side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top wins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Meilleures progressions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.topWins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun objectif actif</p>
            ) : (
              snapshot.topWins.map((w, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{w.title}</span>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    {w.progress}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top risks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Points de vigilance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.topRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun risque détecté</p>
            ) : (
              snapshot.topRisks.map((r, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1 mr-2">{r.title}</span>
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      {r.confidence}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Momentum */}
      {momentum.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Analyse de momentum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {momentum.map((m) => {
                const tc = trendConfig[m.trend];
                const Icon = tc.icon;
                return (
                  <div
                    key={m.objectiveId}
                    className="flex items-center gap-2 p-2 rounded-lg border"
                  >
                    <div className={`p-1 rounded ${tc.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${tc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{m.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{tc.label}</span>
                        <DeltaBadge value={m.progressDelta} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OKRExecutiveSnapshot;
