import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface SentDevis {
  id: string;
  created_at: string;
  details: {
    formation_name?: string;
    client_name?: string;
    type_subrogation?: string;
    nb_participants?: number;
    form_data?: Record<string, unknown>;
  };
}

interface SentDevisSectionProps {
  email: string | null;
  cardId: string | null;
}

const SentDevisSection = ({ email, cardId }: SentDevisSectionProps) => {
  const { data: sentDevis, isLoading, refetch } = useQuery({
    queryKey: ["crm-sent-devis", email, cardId],
    queryFn: async () => {
      if (!email && !cardId) return [];

      // Fetch by matching email OR by crmCardId stored in details
      let query = supabase
        .from("activity_logs")
        .select("id, created_at, details")
        .eq("action_type", "micro_devis_sent")
        .order("created_at", { ascending: false })
        .limit(20);

      if (email) {
        query = query.eq("recipient_email", email);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SentDevis[];
    },
    enabled: !!(email || cardId),
  });

  if (!email && !cardId) return null;
  if (isLoading) return null;
  if (!sentDevis || sentDevis.length === 0) return null;

  const handleDuplicate = (devis: SentDevis) => {
    const formData = devis.details?.form_data;
    if (!formData) {
      toast.error("Pas de données de formulaire pour dupliquer");
      return;
    }

    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    if (cardId) params.set("crmCardId", cardId);
    params.set("source", "crm");

    window.open(`/micro-devis?${params.toString()}`, "_blank");
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Devis envoyés ({sentDevis.length})
        </h4>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-2">
        {sentDevis.map((devis) => (
          <div
            key={devis.id}
            className="p-3 bg-muted/50 rounded-lg text-sm space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">
                {devis.details?.formation_name || "Devis"}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(devis.created_at), "dd MMM yyyy", { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {devis.details?.client_name && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {devis.details.client_name}
                </Badge>
              )}
              {devis.details?.type_subrogation && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {devis.details.type_subrogation === "sans"
                    ? "Sans subrogation"
                    : devis.details.type_subrogation === "avec"
                    ? "Avec subrogation"
                    : "Les 2 devis"}
                </Badge>
              )}
              {devis.details?.nb_participants && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {devis.details.nb_participants} participant{devis.details.nb_participants > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {devis.details?.form_data && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2 mt-1"
                onClick={() => handleDuplicate(devis)}
              >
                <Copy className="h-3 w-3 mr-1" />
                Dupliquer
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SentDevisSection;
