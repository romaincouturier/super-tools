import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Plus, UserPlus, Search, Calendar, Building, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Training {
  id: string;
  training_name: string;
  start_date: string;
  client_name: string;
  format_formation: string | null;
}

interface QuoteOption {
  id: string;
  quote_number: string | null;
  issue_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  synthesis: string | null;
  status: string | null;
}

export interface SelectedQuoteInfo {
  quoteId: string;
  totalHt: number | null;
}

interface CreateTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCreate: () => void;
  onConfirmAddParticipant: (trainingId: string, quote: SelectedQuoteInfo | null) => void;
  opportunityTitle: string;
  isFormation: boolean;
  /** CRM card id to fetch quotes and pick the winning one. */
  crmCardId?: string | null;
}

export function CreateTrainingDialog({
  open,
  onOpenChange,
  onConfirmCreate,
  onConfirmAddParticipant,
  opportunityTitle,
  isFormation,
  crmCardId,
}: CreateTrainingDialogProps) {
  const [mode, setMode] = useState<"choice" | "select-quote" | "select-training">("choice");
  const [trainingSearch, setTrainingSearch] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<SelectedQuoteInfo | null>(null);

  useEffect(() => {
    if (open) {
      setMode("choice");
      setTrainingSearch("");
      setSelectedQuote(null);
    }
  }, [open]);

  const { data: quotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["crm-card-quotes", crmCardId],
    queryFn: async () => {
      if (!crmCardId) return [] as QuoteOption[];
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, issue_date, total_ht, total_ttc, synthesis, status")
        .eq("crm_card_id", crmCardId)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QuoteOption[];
    },
    enabled: open && !!crmCardId,
    staleTime: 30_000,
  });

  const { data: trainings = [], isLoading: loadingTrainings } = useQuery({
    queryKey: ["trainings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .eq("is_cancelled", false)
        .order("start_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Training[];
    },
    enabled: mode === "select-training",
    staleTime: 60_000,
  });

  const filteredTrainings = useMemo(() => {
    if (!trainingSearch.trim()) return trainings;
    const q = trainingSearch.toLowerCase().trim();
    return trainings.filter(
      (t) =>
        t.training_name.toLowerCase().includes(q) ||
        t.client_name.toLowerCase().includes(q)
    );
  }, [trainings, trainingSearch]);

  const handleAddParticipantChoice = () => {
    // If multiple non-draft quotes exist, ask which one is the winning one first.
    if (quotes.length >= 2) {
      setMode("select-quote");
    } else {
      if (quotes.length === 1) {
        setSelectedQuote({ quoteId: quotes[0].id, totalHt: quotes[0].total_ht });
      }
      setMode("select-training");
    }
  };

  const handlePickQuote = (q: QuoteOption) => {
    setSelectedQuote({ quoteId: q.id, totalHt: q.total_ht });
    setMode("select-training");
  };

  const formatAmount = (n: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  // Choice screen
  if (mode === "choice") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="w-full sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Opportunité gagnée !</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              L'opportunité <strong>"{opportunityTitle}"</strong> a été marquée comme gagnée.
              {isFormation && (
                <>
                  <br /><br />
                  Que souhaitez-vous faire ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isFormation ? (
            <div className="space-y-2 py-2">
              <Button
                variant="default"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={onConfirmCreate}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Créer une nouvelle formation</div>
                  <div className="text-xs font-normal opacity-80">
                    Les informations seront préremplies automatiquement
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={handleAddParticipantChoice}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Ajouter comme participant à une formation existante</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Sélectionnez la formation dans la liste
                  </div>
                </div>
              </Button>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
            {!isFormation && (
              <Button onClick={onConfirmCreate}>
                Oui, créer la formation
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Select winning quote screen
  if (mode === "select-quote") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="w-full sm:max-w-lg max-h-[80vh] flex flex-col">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Quel devis a été gagné ?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Plusieurs devis ont été envoyés pour cette opportunité. Sélectionnez celui qui a été
              accepté — le montant vendu du participant sera défini en conséquence.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 min-h-0 py-2">
            {loadingQuotes ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" className="text-primary" />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-1">
                {quotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handlePickQuote(q)}
                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                  >
                    <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {q.quote_number || "Devis sans numéro"} — {formatAmount(q.total_ht)} HT
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {q.synthesis || "Pas de synthèse"}
                      </div>
                      {q.issue_date && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Émis le {format(parseISO(q.issue_date), "d MMM yyyy", { locale: fr })}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setMode("choice")}>
              Retour
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedQuote(null);
                setMode("select-training");
              }}
            >
              Ignorer
            </Button>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Select existing training screen
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full sm:max-w-lg max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Choisir une formation</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Sélectionnez la formation à laquelle ajouter le participant.
            {selectedQuote?.totalHt != null && (
              <>
                {" "}
                Le montant vendu sera défini à <strong>{formatAmount(selectedQuote.totalHt)} HT</strong>.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 flex-1 min-h-0 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou client..."
              value={trainingSearch}
              onChange={(e) => setTrainingSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {loadingTrainings ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-primary" />
            </div>
          ) : filteredTrainings.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {trainingSearch ? `Aucune formation trouvée pour "${trainingSearch}"` : "Aucune formation disponible"}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
              {filteredTrainings.map((training) => (
                <button
                  key={training.id}
                  onClick={() => onConfirmAddParticipant(training.id, selectedQuote)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{training.training_name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {training.client_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(training.start_date), "d MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => setMode(quotes.length >= 2 ? "select-quote" : "choice")}>
            Retour
          </Button>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
