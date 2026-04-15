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
  serviceType: "formation" | "mission" | null;

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
    handleConfirmCreateTraining,
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

  useEffect(() => {
    if (!showWinChoiceDialog) {
      setShowAttachTraining(false);
      setShowFirstAction(false);
      setFirstActionDate("");
      setFirstActionText("");
      return;
    }
    const fetchInterTrainings = async () => {
      setInterTrainingsLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .in("format_formation", ["inter-entreprises", "e_learning"])
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(50);
      if (!error && data) setInterTrainings(data as any);
      setInterTrainingsLoading(false);
    };
    fetchInterTrainings();
  }, [showWinChoiceDialog]);

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

  const handleAttachToTraining = (trainingId: string) => {
    setShowWinChoiceDialog(false);
    onOpenChange(false);
    const params = new URLSearchParams();
    if (firstName) params.set("addParticipantFirstName", firstName);
    if (lastName) params.set("addParticipantLastName", lastName);
    if (email) params.set("addParticipantEmail", email);
    if (company) params.set("addParticipantCompany", company);
    if (estimatedValue && parseFloat(estimatedValue) > 0) {
      params.set("addParticipantSoldPriceHt", estimatedValue);
    }
    if (cardId) params.set("fromCrmCardId", cardId);
    const qs = params.toString();
    navigate(`/formations/${trainingId}${qs ? `?${qs}` : ""}`);
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
                        onClick={() => handleAttachToTraining(training.id)}
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
    </>
  );
};

export default CardDetailDialogs;
