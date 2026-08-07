import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useElearningIntegrations } from "@/hooks/useElearningIntegrations";
import { STATUS_LABEL, isHealthy, type IntegrationStatus } from "@/lib/elearningIntegration";

const TONE: Record<IntegrationStatus, string> = {
  ok: "border-emerald-200 bg-emerald-500/10 text-emerald-800",
  ok_fallback: "border-amber-200 bg-amber-500/10 text-amber-800",
  no_woo: "border-red-200 bg-red-500/10 text-red-800",
  no_formula: "border-red-200 bg-red-500/10 text-red-800",
  no_session: "border-red-200 bg-red-500/10 text-red-800",
  not_applicable: "border-border bg-muted text-muted-foreground",
};

function StatusIcon({ status }: { status: IntegrationStatus }) {
  if (isHealthy(status)) return <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />;
  if (status === "not_applicable") return <Info className="w-4 h-4 mt-0.5 shrink-0" />;
  return <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />;
}

export default function CourseIntegrationStatus({ courseId }: { courseId: string }) {
  const { data, isLoading } = useElearningIntegrations();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Vérification de l'intégration…
      </div>
    );
  }

  const integration = data?.byCourseId[courseId];
  if (!integration) return null;

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${TONE[integration.status]}`}>
      <div className="flex items-start gap-2">
        <StatusIcon status={integration.status} />
        <div className="space-y-1">
          <p className="font-medium">Intégration supertilt.fr : {STATUS_LABEL[integration.status]}</p>
          <p className="text-xs opacity-90">{integration.detail}</p>
          {integration.wooProductIds.length > 0 && (
            <p className="text-xs opacity-90">
              Produit(s) WooCommerce : {integration.wooProductIds.map((id) => `#${id}`).join(", ")}
            </p>
          )}
          {integration.action && (
            <div className="space-y-1">
              <p className="text-xs">
                <span className="font-medium">À faire :</span> {integration.action}
              </p>
              {integration.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {integration.actions.map((a) => (
                    <Button key={a.to} asChild variant="secondary" size="sm">
                      <Link to={a.to}>{a.label}</Link>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
