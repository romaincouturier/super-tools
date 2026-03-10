import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ModuleLayout from "@/components/ModuleLayout";
import QuoteWorkflow from "@/components/quotes/QuoteWorkflow";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CrmCard } from "@/types/crm";

export default function QuoteWorkflowPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [crmCard, setCrmCard] = useState<CrmCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardId) {
      setError("Aucune opportunité sélectionnée.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error: fetchError } = await (supabase as any)
          .from("crm_cards")
          .select("*")
          .eq("id", cardId)
          .single();

        if (fetchError) throw fetchError;
        setCrmCard(data as CrmCard);
      } catch (e: any) {
        setError(e.message || "Opportunité introuvable.");
      } finally {
        setLoading(false);
      }
    })();
  }, [cardId]);

  return (
    <ModuleLayout>
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Création de devis</h1>
            {crmCard && (
              <p className="text-sm text-muted-foreground">
                {crmCard.title} — {crmCard.company || "Client"}
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate("/crm")}>
              Retour au CRM
            </Button>
          </div>
        )}

        {crmCard && <QuoteWorkflow crmCard={crmCard} />}
      </div>
    </ModuleLayout>
  );
}
