import { Link } from "react-router-dom";
import { Star, Check, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskName, maskEmail } from "@/lib/demoMask";
import { toast } from "sonner";

interface Row {
  id: string;
  mission_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  missions: { title: string; client_name: string | null } | null;
}

const AvisADemander = () => {
  const qc = useQueryClient();
  const { isDemoMode } = useDemoMode();
  const { data = [], isLoading } = useQuery({
    queryKey: ["testimonial-requests-todo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("testimonial_requests")
        .select("id, mission_id, contact_name, contact_email, created_at, missions(title, client_name)")
        .eq("status", "todo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const mark = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "done" | "dismissed" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("testimonial_requests")
        .update({ status, done_at: new Date().toISOString(), done_by: u.user?.id ?? null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "done" ? "Marqué comme fait" : "Demande abandonnée");
      qc.invalidateQueries({ queryKey: ["testimonial-requests-todo"] });
      qc.invalidateQueries({ queryKey: ["testimonial-requests-count"] });
    },
    onError: () => toast.error("Impossible d'enregistrer, réessayez"),
  });

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
