import { useEffect, useState } from "react";
import { useQuotesByCard } from "@/hooks/useQuotes";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Mail, CheckCircle2, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { QuoteStatus } from "@/types/quotes";

const statusLabels: Record<QuoteStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  generated: { label: "Généré", variant: "outline" },
  sent: { label: "Envoyé", variant: "default" },
  signed: { label: "Signé", variant: "default" },
  expired: { label: "Expiré", variant: "destructive" },
  canceled: { label: "Annulé", variant: "destructive" },
};

interface SignedDevis {
  id: string;
  formation_name: string;
  client_name: string;
  recipient_name: string | null;
  devis_type: string;
  signed_at: string;
  signed_pdf_url: string | null;
  total_amount_ht: number | null;
  created_at: string;
}

interface Props {
  cardId: string;
}

export default function QuoteHistorySection({ cardId }: Props) {
  const { data: quotes, isLoading } = useQuotesByCard(cardId);
  const navigate = useNavigate();
  const [signedDevis, setSignedDevis] = useState<SignedDevis[]>([]);
  const [loadingSignedDevis, setLoadingSignedDevis] = useState(true);

  useEffect(() => {
    setLoadingSignedDevis(true);
    (supabase as any)
      .from("devis_signatures")
      .select("id, formation_name, client_name, recipient_name, devis_type, signed_at, signed_pdf_url, total_amount_ht, created_at")
      .eq("crm_card_id", cardId)
      .eq("status", "signed")
      .not("signed_pdf_url", "is", null)
      .order("signed_at", { ascending: false })
      .then(({ data }: { data: SignedDevis[] | null }) => {
        setSignedDevis((data as SignedDevis[]) ?? []);
        setLoadingSignedDevis(false);
      });
  }, [cardId]);

  const isLoaded = !isLoading && !loadingSignedDevis;
  const hasQuotes = quotes && quotes.length > 0;
  const hasSignedDevis = signedDevis.length > 0;

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Spinner />
        <span className="text-sm text-muted-foreground">Chargement des devis...</span>
      </div>
    );
  }

  if (!hasQuotes && !hasSignedDevis) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Aucun devis créé pour cette opportunité.
      </p>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="space-y-4">
      {/* Signed MicroDevis PDFs */}
      {hasSignedDevis && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Devis signés
          </h4>
          {signedDevis.map((d) => (
            <div
              key={d.id}
              className="p-3 border border-green-200 dark:border-green-800 rounded-lg space-y-2 bg-green-50/50 dark:bg-green-950/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">{d.formation_name}</span>
                  <Badge variant="default" className="bg-green-600 text-white text-xs">Signé</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(d.signed_at), "d MMM yyyy", { locale: fr })}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {d.recipient_name || d.client_name}
                  {d.devis_type === "avec_subrogation" ? " · Avec subrogation" : " · Sans subrogation"}
                </span>
                {d.total_amount_ht != null && (
                  <span className="font-medium">{fmt(d.total_amount_ht)} HT</span>
                )}
              </div>

              {d.signed_pdf_url && (
                <a
                  href={d.signed_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 hover:underline"
                >
                  <Download className="w-3 h-3" />
                  Télécharger le devis signé (PDF)
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Regular quotes */}
      {hasQuotes && (
        <div className="space-y-2">
          {hasSignedDevis && (
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Devis créés
            </h4>
          )}
          {quotes!.map((q) => {
            const status = statusLabels[q.status as QuoteStatus] || statusLabels.draft;
            return (
              <div
                key={q.id}
                className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{q.quote_number}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(q.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{q.client_company}</span>
                  <span className="font-medium">{fmt(q.total_ttc)}</span>
                </div>

                {q.email_sent_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    Envoyé le {format(new Date(q.email_sent_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/devis/${cardId}?quoteId=${q.id}`)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Ouvrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
