import { Button } from "@/components/ui/button";
import {
  Loader2,
  Brain,
  FileSignature,
  Receipt,
  LinkIcon,
  ExternalLink,
  FileText,
  X,
  Copy,
  ClipboardList,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuotesByCard, useDeleteQuote } from "@/hooks/useQuotes";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailCommercial = ({ state, handlers }: Props) => {
  const navigate = useNavigate();
  const {
    card, serviceType, company, email, firstName, lastName,
    estimatedValue, quoteUrl, setQuoteUrl, descriptionHtml,
    aiAnalyzing, aiAnalysis, setAiAnalysis,
    quoteGenerating, quoteDescription, setQuoteDescription,
  } = state;

  const { data: existingQuotes } = useQuotesByCard(card?.id);
  const draftQuotes = (existingQuotes || []).filter(q => q.status !== 'signed');
  const deleteQuote = useDeleteQuote();

  const stepLabels = ["Synthèse", "Loom", "Déplacements", "Client", "Devis", "Email"];

  return (
    <div className="space-y-4 mt-6 border-t pt-4">
      <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
        Commercial
      </h4>

      {/* Devis buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/devis/${card.id}`)}
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Créer un devis guidé
        </Button>
        {serviceType === "formation" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({
                ...(company && { nomClient: company }),
                ...(email && { emailCommanditaire: email }),
                ...((firstName || lastName) && { adresseCommanditaire: [firstName, lastName].filter(Boolean).join(" ") }),
                ...(card?.id && { crmCardId: card.id }),
                source: "crm",
              });
              window.open(`/micro-devis?${params.toString()}`, "_blank");
            }}
          >
            <Receipt className="h-4 w-4 mr-2" />
            Créer un devis formation
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = prompt("URL du devis existant :", quoteUrl);
            if (url !== null) {
              setQuoteUrl(url);
            }
          }}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Lier à un devis existant
        </Button>
        {quoteUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={quoteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir le devis
            </a>
          </Button>
        )}
      </div>

      {/* Existing draft quotes */}
      {draftQuotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Devis en cours</p>
          {draftQuotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{q.quote_number}</p>
                <p className="text-xs text-muted-foreground">
                  {q.client_company} — Étape : {stepLabels[(q as unknown as { workflow_step?: number }).workflow_step ?? 0] || "Client"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/devis/${card.id}?quoteId=${q.id}`)}
                  className="gap-1.5"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Reprendre
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={deleteQuote.isPending}
                  onClick={() => {
                    if (window.confirm(`Supprimer le devis ${q.quote_number} ?`)) {
                      deleteQuote.mutate(q.id);
                    }
                  }}
                >
                  {deleteQuote.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handlers.handleAiAnalysis}
          disabled={aiAnalyzing || !descriptionHtml.trim()}
        >
          {aiAnalyzing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Brain className="h-4 w-4 mr-2" />
          )}
          Analyser avec l'IA
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlers.handleGenerateQuoteDescription}
          disabled={quoteGenerating || !descriptionHtml.trim()}
        >
          {quoteGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSignature className="h-4 w-4 mr-2" />
          )}
          Générer descriptif devis
        </Button>
      </div>

      {/* AI Analysis result */}
      {aiAnalysis && (
        <div className="p-4 bg-purple-50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2 text-purple-700">
              <Brain className="h-4 w-4" />
              Analyse IA
            </h4>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handlers.copyToClipboard(aiAnalysis)} title="Copier">
                <FileText className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAiAnalysis(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="text-sm whitespace-pre-wrap text-purple-900">{aiAnalysis}</div>
        </div>
      )}

      {/* Quote description result */}
      {quoteDescription && (
        <div className="p-4 bg-emerald-50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2 text-emerald-700">
              <FileSignature className="h-4 w-4" />
              Descriptif pour devis
            </h4>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handlers.copyToClipboard(quoteDescription)} title="Copier">
                <FileText className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setQuoteDescription(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="text-sm whitespace-pre-wrap text-emerald-900">{quoteDescription}</div>
        </div>
      )}
    </div>
  );
};

export default CardDetailCommercial;
