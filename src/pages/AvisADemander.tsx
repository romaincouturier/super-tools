import { Link } from "react-router-dom";
import { Star, Check, X } from "lucide-react";
import { useTestimonialRequests } from "@/hooks/useTestimonialRequests";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskName, maskEmail } from "@/lib/demoMask";

const AvisADemander = () => {
  const { isDemoMode } = useDemoMode();
  const { data = [], isLoading, mark } = useTestimonialRequests();

  return (
    <ModuleLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          icon={Star}
          title="Avis à demander"
          subtitle="Demandes d'avis, recommandations et témoignages à rédiger sur mesure, contact par contact"
        />
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-2">
            {data.map((r) => {
              const name = r.contact_name || r.contact_email || "Contact";
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        Demander un avis / témoignage à {isDemoMode ? maskName(name) : name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.contact_email && <>{isDemoMode ? maskEmail(r.contact_email) : r.contact_email} · </>}
                        {r.mission_id ? (
                          <Link to={`/missions/${r.mission_id}`} className="underline">
                            Mission {r.missions?.title ?? ""}
                          </Link>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => mark.mutate({ id: r.id, status: "done" })} disabled={mark.isPending}>
                        <Check className="h-4 w-4 mr-1" /> Fait
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mark.mutate({ id: r.id, status: "dismissed" })} disabled={mark.isPending}>
                        <X className="h-4 w-4 mr-1" /> Abandonner
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
};

export default AvisADemander;
