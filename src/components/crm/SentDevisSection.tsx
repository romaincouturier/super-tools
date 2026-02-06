import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Copy, RefreshCw, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface SentDevisDetails {
  formation_name?: string;
  client_name?: string;
  type_subrogation?: string;
  nb_participants?: number;
  pdf_sans_subrogation_url?: string;
  pdf_avec_subrogation_url?: string;
  form_data?: Record<string, unknown>;
}

interface SentDevis {
  id: string;
  created_at: string;
  details: SentDevisDetails;
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

  const handleOpenPdf = (url: string) => {
    window.open(url, "_blank");
  };

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

  const getSubrogationLabel = (type?: string) => {
    switch (type) {
      case "sans": return "Sans subrogation";
      case "avec": return "Avec subrogation";
      case "les2": return "Les 2 devis";
      default: return type;
    }
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
        {sentDevis.map((devis) => {
          const details = devis.details;
          const hasSansPdf = !!details?.pdf_sans_subrogation_url;
          const hasAvecPdf = !!details?.pdf_avec_subrogation_url;
          const hasPdf = hasSansPdf || hasAvecPdf;

          return (
            <div
              key={devis.id}
              className="p-3 bg-muted/50 rounded-lg text-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">
                  {details?.formation_name || "Devis"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(devis.created_at), "dd MMM yyyy", { locale: fr })}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {details?.client_name && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {details.client_name}
                  </Badge>
                )}
                {details?.type_subrogation && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {getSubrogationLabel(details.type_subrogation)}
                  </Badge>
                )}
                {details?.nb_participants && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {details.nb_participants} participant{details.nb_participants > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {hasSansPdf && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handleOpenPdf(details.pdf_sans_subrogation_url!)}
                  >
                    <FileDown className="h-3 w-3 mr-1" />
                    {details?.type_subrogation === "les2" ? "PDF sans subrogation" : "Ouvrir le PDF"}
                  </Button>
                )}
                {hasAvecPdf && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handleOpenPdf(details.pdf_avec_subrogation_url!)}
                  >
                    <FileDown className="h-3 w-3 mr-1" />
                    {details?.type_subrogation === "les2" ? "PDF avec subrogation" : "Ouvrir le PDF"}
                  </Button>
                )}
                {!hasPdf && (
                  <span className="text-[10px] text-muted-foreground italic">
                    PDF non disponible (généré avant la mise à jour)
                  </span>
                )}
                {details?.form_data && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handleDuplicate(devis)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Dupliquer
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SentDevisSection;
