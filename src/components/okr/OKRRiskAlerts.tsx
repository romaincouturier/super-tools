import { AlertTriangle, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OKRRiskAlert, RiskSeverity } from "@/lib/okrRiskEngine";

const severityConfig: Record<RiskSeverity, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Critique" },
  warning: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Attention" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", label: "Info" },
};

interface OKRRiskAlertsProps {
  alerts: OKRRiskAlert[];
  onClickObjective?: (objectiveId: string) => void;
}

const OKRRiskAlerts = ({ alerts, onClickObjective }: OKRRiskAlertsProps) => {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="font-medium text-green-700">Aucune alerte de risque</p>
          <p className="text-sm">Tous vos OKRs sont en bonne voie</p>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Radar de risques
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critique{criticalCount > 1 ? "s" : ""}</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                {warningCount} attention
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.slice(0, 8).map((alert, i) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;

          return (
            <div
              key={`${alert.objectiveId}-${alert.type}-${i}`}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${config.bg}`}
              onClick={() => onClickObjective?.(alert.objectiveId)}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{alert.objectiveTitle}</p>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {config.label}
              </Badge>
            </div>
          );
        })}
        {alerts.length > 8 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{alerts.length - 8} autre{alerts.length - 8 > 1 ? "s" : ""} alerte{alerts.length - 8 > 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OKRRiskAlerts;
