import { useState } from "react";
import { Link } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { useElearningIntegrations } from "@/hooks/useElearningIntegrations";
import { STATUS_LABEL, isHealthy, type IntegrationStatus } from "@/lib/elearningIntegration";

const BADGE_TONE: Record<IntegrationStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  ok_fallback: "bg-amber-500/10 text-amber-700 border-amber-200",
  no_woo: "bg-red-500/10 text-red-700 border-red-200",
  no_formula: "bg-red-500/10 text-red-700 border-red-200",
  no_session: "bg-red-500/10 text-red-700 border-red-200",
  not_applicable: "bg-muted text-muted-foreground",
};

export default function ElearningIntegrations() {
  const { data, isLoading, isError, refetch, isFetching } = useElearningIntegrations();
  const [hideOk, setHideOk] = useState(false);
  const [hideNa, setHideNa] = useState(true);

  const summary = data?.summary;
  const rows = (data?.results ?? []).filter((r) => {
    if (hideOk && isHealthy(r.status)) return false;
    if (hideNa && r.status === "not_applicable") return false;
    return true;
  });

  return (
    <ModuleLayout>
      <div className="container py-6 space-y-6 max-w-5xl">
        <PageHeader
          icon={Plug}
          title="Intégrations e-learning ↔ supertilt.fr"
          subtitle="Vérifie, par cours publié, que la chaîne d'inscription automatique WooCommerce est complète"
          backTo="/lms"
        />


        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Spinner size="md" /> Analyse des intégrations…
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Impossible de charger le diagnostic d'intégration.
            </CardContent>
          </Card>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="flex items-center gap-3 py-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="text-2xl font-bold">{summary.healthy}</p>
                      <p className="text-sm text-muted-foreground">Intégrations OK</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 py-4">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold">{summary.toFix}</p>
                      <p className="text-sm text-muted-foreground">À corriger</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Plug className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{summary.notApplicable}</p>
                      <p className="text-sm text-muted-foreground">Non concernés (intra)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant={hideOk ? "default" : "outline"} size="sm" onClick={() => setHideOk((v) => !v)}>
                {hideOk ? "Afficher les OK" : "Masquer les OK"}
              </Button>
              <Button variant={hideNa ? "default" : "outline"} size="sm" onClick={() => setHideNa((v) => !v)}>
                {hideNa ? "Afficher les non concernés" : "Masquer les non concernés"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                Actualiser les statuts
              </Button>
            </div>


            {rows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Aucun cours à afficher avec ces filtres.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <Card key={r.courseId}>
                    <CardContent className="py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{r.courseTitle}</p>
                        <Badge variant="outline" className={`shrink-0 ${BADGE_TONE[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.detail}</p>
                      {r.trainings.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Session(s) : {r.trainings.map((t) => t.name).join(", ")}
                        </p>
                      )}
                      {r.wooProductIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Produit(s) WooCommerce : {r.wooProductIds.map((id) => `#${id}`).join(", ")}
                        </p>
                      )}
                      {r.action && (
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="font-medium">À faire :</span> {r.action}
                          </p>
                          {r.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {r.actions.map((a) => (
                                <Button key={a.to} asChild variant="secondary" size="sm">
                                  <Link to={a.to}>
                                    {a.label}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Link>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModuleLayout>
  );
}
