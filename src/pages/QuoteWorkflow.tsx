import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import ModuleLayout from "@/components/ModuleLayout";
import QuoteWorkflow from "@/components/quotes/QuoteWorkflow";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import type { CrmCard } from "@/types/crm";

export default function QuoteWorkflowPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [searchParams] = useSearchParams();
  const existingQuoteId = searchParams.get("quoteId") || undefined;
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
        const { data, error: fetchError } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
          .from("crm_cards")
          .select("*")
          .eq("id", cardId)
          .single();

        if (fetchError) throw fetchError;
        setCrmCard(data as CrmCard);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    })();
  }, [cardId]);

  return (
    <ModuleLayout>
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <PageHeader
          icon={FileText}
          title="Création de devis"
          subtitle={crmCard ? `${crmCard.title} — ${crmCard.company || "Client"}` : undefined}
          backTo="/crm"
        />

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

        {crmCard && <QuoteWorkflow crmCard={crmCard} existingQuoteId={existingQuoteId} />}
      </div>
    </ModuleLayout>
  );
}
