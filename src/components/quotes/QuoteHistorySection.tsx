import { useQuotesByCard } from "@/hooks/useQuotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ExternalLink, Mail } from "lucide-react";
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

interface Props {
  cardId: string;
}

export default function QuoteHistorySection({ cardId }: Props) {
  const { data: quotes, isLoading } = useQuotesByCard(cardId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Chargement des devis...</span>
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Aucun devis créé pour cette opportunité.
      </p>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
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
  );
}
