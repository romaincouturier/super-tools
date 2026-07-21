import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Calendar,
  CalendarPlus,
  Trophy,
  GraduationCap,
  Rocket,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import LossReasonDialog from "../LossReasonDialog";
import MacroPricingDialog, { PricingLine } from "../MacroPricingDialog";
import { CreateTrainingDialog } from "../CreateTrainingDialog";
import type { LossReason } from "@/types/crm";

interface Props {
  cardId: string;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  estimatedValue: string;
  serviceType: "formation" | "mission" | "jeu" | null;

  // Loss reason
  showLossReasonDialog: boolean;
  onLossReasonConfirm: (reason: LossReason, detail: string) => void;
  onLossReasonCancel: () => void;

  // Pricing
  showPricingDialog: boolean;
  setShowPricingDialog: (v: boolean) => void;
  pricingLines: PricingLine[];
  setPricingLines: (v: PricingLine[]) => void;
  pricingTravelTotal: number;
  setPricingTravelTotal: (v: number) => void;
  setEstimatedValue: (v: string) => void;

  // Create training
  showCreateTrainingDialog: boolean;
  setShowCreateTrainingDialog: (v: boolean) => void;
  pendingTrainingParams: URLSearchParams | null;
  handleConfirmCreateTraining: () => void;
  initialSiren?: string | null;
  onSirenResolved?: (overrides: { siren?: string; company?: string; address?: string; postal_code?: string; city?: string }) => void;

  // Win choice
  showWinChoiceDialog: boolean;
  setShowWinChoiceDialog: (v: boolean) => void;
  handleConfirmCreateMission: () => void;

  onOpenChange: (v: boolean) => void;
}

const CardDetailDialogs = (props: Props) => {
  const navigate = useNavigate();
  const {
    cardId, title, firstName, lastName, email, company, estimatedValue, serviceType,
    showLossReasonDialog, onLossReasonConfirm, onLossReasonCancel,
    showPricingDialog, setShowPricingDialog, pricingLines, setPricingLines,
    pricingTravelTotal, setPricingTravelTotal, setEstimatedValue,
    showCreateTrainingDialog, setShowCreateTrainingDialog, pendingTrainingParams: _pendingTrainingParams,
    handleConfirmCreateTraining, initialSiren, onSirenResolved,
    showWinChoiceDialog, setShowWinChoiceDialog, handleConfirmCreateMission,
    onOpenChange,
  } = props;

  const [showAttachTraining, setShowAttachTraining] = useState(false);
  const [showFirstAction, setShowFirstAction] = useState(false);
  const [firstActionDate, setFirstActionDate] = useState("");
  const [firstActionText, setFirstActionText] = useState("");
  const [savingFirstAction, setSavingFirstAction] = useState(false);
  const [interTrainings, setInterTrainings] = useState<Array<{
    id: string;
    training_name: string;
    start_date: string;
    client_name: string;
    format_formation: string | null;
  }>>([]);
  const [interTrainingsLoading, setInterTrainingsLoading] = useState(false);

  const [cardQuotes, setCardQuotes] = useState<Array<{
    id: string;
    quote_number: string | null;
    issue_date: string | null;
    total_ht: number | null;
    synthesis: string | null;
  }>>([]);
  const [pendingAttachTrainingId, setPendingAttachTrainingId] = useState<string | null>(null);

  useEffect(() => {
    if (!showWinChoiceDialog) {
      setShowAttachTraining(false);
      setShowFirstAction(false);
      setFirstActionDate("");
      setFirstActionText("");
      setPendingAttachTrainingId(null);
      return;
    }
    const fetchInterTrainings = async () => {
      setInterTrainingsLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .in("format_formation", ["inter-entreprises", "e_learning", "classe_virtuelle"])
        .eq("is_cancelled", false)
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(50);
      if (!error && data) setInterTrainings(data as any);
      setInterTrainingsLoading(false);
    };
    const fetchQuotes = async () => {
      if (!cardId) return;
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, issue_date, total_ht, synthesis")
        .eq("crm_card_id", cardId)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      setCardQuotes((data || []) as typeof cardQuotes);
    };
    fetchInterTrainings();
    fetchQuotes();
  }, [showWinChoiceDialog, cardId]);

  const handleCreateMissionWithAction = async () => {
    if (firstActionDate && cardId) {
      setSavingFirstAction(true);
      await supabase
        .from("crm_cards")
        .update({
          waiting_next_action_date: firstActionDate,
          waiting_next_action_text: firstActionText.trim() || null,
          status_operational: "WAITING",
        })
        .eq("id", cardId);
      setSavingFirstAction(false);
    }
    handleConfirmCreateMission();
  };

  const handleAttachToTrainingClick = (trainingId: string) => {
    // If several non-draft quotes exist, ask which one is the winning one first.
    if (cardQuotes.length >= 2) {
      setPendingAttachTrainingId(trainingId);
      return;
    }
    const q = cardQuotes[0];
    handleAttachToTraining(trainingId, q ? { quoteId: q.id, totalHt: q.total_ht } : null);
  };

  const handleAttachToTraining = async (
    trainingId: string,
    selectedQuote: { quoteId: string; totalHt: number | null } | null,
  ) => {
    setShowWinChoiceDialog(false);
    onOpenChange(false);

    // Fetch full card (address) + winning (or latest) quote / micro-devis for participant + address + formule
    let cardAddress: string | null = null;
    let cardZip: string | null = null;
    let cardCity: string | null = null;
    let selectedFormulaId: string | null = null;
    let participantFirstName: string | undefined;
    let participantLastName: string | undefined;
    let participantEmail: string | undefined;

    if (cardId) {
      const { data: cardRow } = await supabase
        .from("crm_cards")
        .select("address, postal_code, city")
        .eq("id", cardId)
        .maybeSingle();
      if (cardRow) {
        cardAddress = cardRow.address;
        cardZip = cardRow.postal_code;
        cardCity = cardRow.city;
      }

      const baseQuote = supabase
        .from("quotes")
        .select("line_items, client_address, client_zip, client_city, total_ht");
      const { data: quoteRow } = selectedQuote
        ? await baseQuote.eq("id", selectedQuote.quoteId).maybeSingle()
        : await baseQuote
            .eq("crm_card_id", cardId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

      if (quoteRow) {
        if (!cardAddress && quoteRow.client_address) cardAddress = quoteRow.client_address;
        if (!cardZip && quoteRow.client_zip) cardZip = quoteRow.client_zip;
        if (!cardCity && quoteRow.client_city) cardCity = quoteRow.client_city;

        // Extract first participant from line_items[0].participant_name
        const lineItems = (quoteRow.line_items ?? []) as Array<{ participant_name?: string[] }>;
        const firstLine = lineItems[0];
        const firstParticipantRaw = firstLine?.participant_name?.[0];
        if (firstParticipantRaw && typeof firstParticipantRaw === "string") {
          const emailMatch = firstParticipantRaw.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            participantEmail = emailMatch[0].toLowerCase();
            const beforeEmail = firstParticipantRaw.replace(emailMatch[0], "").trim();
            const parts = beforeEmail.split(/\s+/).filter(Boolean);
            if (parts.length >= 1) participantFirstName = parts[0];
            if (parts.length >= 2) participantLastName = parts.slice(1).join(" ");
          }
        }
      }

      // Fallback: micro-devis stores address + formule dans activity_logs.details.form_data
      if (!cardAddress || !cardZip || !cardCity || !selectedFormulaId) {
        const { data: mdLog } = await supabase
          .from("activity_logs")
          .select("details")
          .eq("action_type", "micro_devis_sent")
          .contains("details", { crm_card_id: cardId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const fd = (mdLog?.details as { form_data?: Record<string, unknown> } | null)?.form_data;
        if (fd) {
          if (!cardAddress && typeof fd.adresseClient === "string") cardAddress = fd.adresseClient;
          if (!cardZip && typeof fd.codePostalClient === "string") cardZip = fd.codePostalClient;
          if (!cardCity && typeof fd.villeClient === "string") cardCity = fd.villeClient;
          if (!selectedFormulaId && typeof fd.selectedFormulaId === "string" && fd.selectedFormulaId) {
            selectedFormulaId = fd.selectedFormulaId;
          }
        }
      }

      // Sold price = winning quote total HT (fallback to latest quote total, then card estimated value)
      const soldPriceHt =
        selectedQuote?.totalHt ??
        (quoteRow && "total_ht" in quoteRow ? (quoteRow as { total_ht: number | null }).total_ht : null) ??
        (estimatedValue ? parseFloat(estimatedValue) : null);

      const params = new URLSearchParams();
      const pFirstName = participantFirstName || firstName;
      const pLastName = participantLastName || lastName;
      const pEmail = participantEmail || email;
      if (pFirstName) params.set("addParticipantFirstName", pFirstName);
      if (pLastName) params.set("addParticipantLastName", pLastName);
      if (pEmail) params.set("addParticipantEmail", pEmail);
      if (company) params.set("addParticipantCompany", company);
      if (cardAddress) params.set("addParticipantCompanyAddress", cardAddress);
      if (cardZip) params.set("addParticipantCompanyZip", cardZip);
      if (cardCity) params.set("addParticipantCompanyCity", cardCity);
      if (selectedFormulaId) params.set("addParticipantFormulaId", selectedFormulaId);

      if (participantEmail && email && participantEmail !== email.toLowerCase()) {
        if (firstName) params.set("addParticipantSponsorFirstName", firstName);
        if (lastName) params.set("addParticipantSponsorLastName", lastName);
        if (email) params.set("addParticipantSponsorEmail", email);
      }

      if (soldPriceHt != null && soldPriceHt > 0) {
        params.set("addParticipantSoldPriceHt", String(soldPriceHt));
      }
      params.set("fromCrmCardId", cardId);
      navigate(`/formations/${trainingId}?${params.toString()}`);
    }
  };

  return (
    <>
      <LossReasonDialog
        open={showLossReasonDialog}
        onConfirm={onLossReasonConfirm}
        onCancel={onLossReasonCancel}
      />

      <MacroPricingDialog
        open={showPricingDialog}
        onOpenChange={setShowPricingDialog}
        initialValue={parseFloat(estimatedValue) || 0}
        initialLines={pricingLines.length > 0 ? pricingLines : undefined}
        initialTravelTotal={pricingTravelTotal}
        onConfirm={(total, lines, travelTotal) => {
          setEstimatedValue(String(total));
          setPricingLines(lines);
          setPricingTravelTotal(travelTotal);
        }}
      />

      <CreateTrainingDialog
        open={showCreateTrainingDialog}
        onOpenChange={setShowCreateTrainingDialog}
        onConfirmCreate={handleConfirmCreateTraining}
        onConfirmAddParticipant={(trainingId) => {
          setShowCreateTrainingDialog(false);
          onOpenChange(false);
          navigate(`/formations/${trainingId}`);
        }}
        opportunityTitle={title}
        isFormation={serviceType === "formation" || !serviceType}
        crmCardId={cardId ?? null}
        initialSiren={initialSiren}
        onSirenResolved={onSirenResolved}
      />

      <AlertDialog open={showWinChoiceDialog} onOpenChange={setShowWinChoiceDialog}>
        <AlertDialogContent className="w-full sm:max-w-lg max-h-[85vh] flex flex-col">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <Trophy className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Opportunité gagnée !</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              L'opportunité <strong>"{title}"</strong> a été marquée comme gagnée.
              <br /><br />
              Que souhaitez-vous créer à partir de cette opportunité ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <Button
              variant="outline"
              className="h-auto flex flex-col items-center gap-2 p-4 hover:border-primary hover:bg-primary/5"
              onClick={() => {
                setShowWinChoiceDialog(false);
                setShowCreateTrainingDialog(true);
              }}
            >
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="font-medium">Créer une formation</span>
              <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
            </Button>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className={cn(
                  "h-auto flex flex-col items-center gap-2 p-4 hover:border-purple-500 hover:bg-purple-50",
                  showFirstAction && "border-purple-500 bg-purple-50"
                )}
                onClick={() => {
                  if (serviceType === "mission") {
                    setShowFirstAction(!showFirstAction);
                  } else {
                    handleConfirmCreateMission();
                  }
                }}
              >
                <Rocket className="h-8 w-8 text-purple-600" />
                <span className="font-medium">Créer une mission</span>
                <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
              </Button>
              {showFirstAction && (
                <div className="border rounded-lg p-3 space-y-2 bg-purple-50/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                    <CalendarPlus className="h-4 w-4" />
                    Première action
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={firstActionDate}
                      onChange={(e) => setFirstActionDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description (optionnel)</Label>
                    <Input
                      placeholder="Ex: Appeler pour cadrer la mission"
                      value={firstActionText}
                      onChange={(e) => setFirstActionText(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={handleCreateMissionWithAction}
                    disabled={!firstActionDate || savingFirstAction}
                  >
                    {savingFirstAction ? (
                      <Spinner className="mr-1" />
                    ) : null}
                    Créer la mission
                  </Button>
                  <button
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                    onClick={handleConfirmCreateMission}
                  >
                    Créer sans programmer d'action
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Attach to existing inter-entreprise */}
          <div className="border-t pt-3">
            <button
              className="w-full flex items-center justify-between text-sm font-medium text-left px-1 py-1 hover:text-primary transition-colors"
              onClick={() => setShowAttachTraining(!showAttachTraining)}
            >
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Attacher à une formation inter-entreprise existante
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAttachTraining && "rotate-180")} />
            </button>

            {showAttachTraining && (
              <div className="mt-2 space-y-2">
                {interTrainingsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : interTrainings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Aucune formation inter-entreprise à venir
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                    {interTrainings.map((training) => (
                      <button
                        key={training.id}
                        onClick={() => handleAttachToTrainingClick(training.id)}
                        className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                      >
                        <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{training.training_name}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(training.start_date), "d MMM yyyy", { locale: fr })}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              Inter-entreprises
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingAttachTrainingId}
        onOpenChange={(open) => { if (!open) setPendingAttachTrainingId(null); }}
      >
        <AlertDialogContent className="w-full sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Quel devis a été gagné ?</AlertDialogTitle>
            <AlertDialogDescription>
              Plusieurs devis ont été envoyés. Sélectionnez celui qui a été accepté — le montant vendu
              du participant sera défini en conséquence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 max-h-72 overflow-y-auto border rounded-md p-1">
            {cardQuotes.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  const trainingId = pendingAttachTrainingId;
                  setPendingAttachTrainingId(null);
                  if (trainingId) handleAttachToTraining(trainingId, { quoteId: q.id, totalHt: q.total_ht });
                }}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="text-sm font-medium">
                  {q.quote_number || "Devis sans numéro"} —{" "}
                  {q.total_ht != null
                    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(q.total_ht)
                    : "—"}{" "}
                  HT
                </div>
                {q.synthesis && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{q.synthesis}</div>
                )}
                {q.issue_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Émis le {format(parseISO(q.issue_date), "d MMM yyyy", { locale: fr })}
                  </div>
                )}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CardDetailDialogs;
