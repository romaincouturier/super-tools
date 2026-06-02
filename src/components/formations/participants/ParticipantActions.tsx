import React from "react";
import { Loader2, Send, Clock, RefreshCw, Receipt, Scroll, Award, Download, Forward, UserCheck, RotateCw, FileSignature, BellRing, Trash2, ClipboardCheck, History, KeyRound } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ViewQuestionnaireDialog from "../ViewQuestionnaireDialog";
import EditParticipantDialog from "../EditParticipantDialog";
import { getStatusConfig } from "./statusConfig";
import type { ParticipantActionsProps } from "./types";

const ParticipantActions = ({
  participant,
  displayName,
  trainingId,
  formatFormation,
  isInterEntreprise,
  isIndividualConvention,
  trainingLocation,
  trainingDuree,
  trainingStartDate,
  trainingEndDate,
  availableFormulas,
  sendingId,
  remindingId,
  sendingMagicLinkId,
  resendingWelcomeId,
  deletingId,
  generatingConventionId,
  downloadingConventionId,
  conventionRemindingId,
  generatingCertId,
  sendingCertId,
  conventionSignatures,
  certificatesByParticipant,
  evaluationsByParticipant,
  participantsWithSignatures,
  participantsWithAccount,
  onSendSurvey,
  onSendReminder,
  onSendMagicLink,
  onResendWelcome,
  onDelete,
  onGenerateConvention,
  onDownloadConvention,
  onSendConventionReminder,
  onGenerateCertificate,
  onSendCertificate,
  onOpenDocuments,
  onOpenTraceability,
  onViewEvaluation,
  onParticipantUpdated,
  canSendSurveyFor,
  canSendReminderFor,
  canSendConventionReminderFor,
}: ParticipantActionsProps) => {
  const surveyStatusConfig = getStatusConfig(participant.needs_survey_status);
  const SurveyStatusIcon = surveyStatusConfig.icon;
  const surveyIconColor = surveyStatusConfig.colorClass ?? (
    surveyStatusConfig.variant === "default" ? "text-primary" :
    surveyStatusConfig.variant === "destructive" ? "text-destructive" :
    "text-muted-foreground"
  );

  return (
    <div className="flex items-center gap-0.5">
      {/* 0a. Convocation status indicator */}
      {(() => {
        const isConvoked = !["non_envoye", "manuel"].includes(participant.needs_survey_status);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`inline-flex items-center justify-center h-7 w-7 ${isConvoked ? "text-primary" : "text-muted-foreground/50"}`}>
                {isConvoked ? <Send className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </span>
            </TooltipTrigger>
            <TooltipContent><p>{isConvoked ? "Convocation envoyée" : "Convocation non envoyée"}</p></TooltipContent>
          </Tooltip>
        );
      })()}

      {/* 0b. Recueil status indicator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center h-7 w-7 ${surveyIconColor}`}>
            <SurveyStatusIcon className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent><p>Recueil : {surveyStatusConfig.tooltip}</p></TooltipContent>
      </Tooltip>

      {/* 1. Convention - inter/e-learning */}
      {isIndividualConvention && (() => {
        const hasConvention = !!participant.convention_file_url;
        const sigInfo = conventionSignatures.get(participant.id);
        const isLoading = generatingConventionId === participant.id || downloadingConventionId === participant.id;

        if (!hasConvention) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onGenerateConvention(participant)} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scroll className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Générer la convention</p></TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scroll className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDownloadConvention(participant)}>
                <Download className="h-4 w-4 mr-2" />Télécharger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onGenerateConvention(participant)}>
                <RotateCw className="h-4 w-4 mr-2" />Ré-générer
              </DropdownMenuItem>
              {sigInfo && !participant.signed_convention_url && (
                <DropdownMenuItem disabled className="text-xs opacity-70">
                  <FileSignature className="h-4 w-4 mr-2" />
                  {sigInfo.status === "signed" ? `Signée le ${new Date(sigInfo.signed_at!).toLocaleDateString("fr-FR")}` : sigInfo.status === "pending" ? "En attente de signature" : `Signature : ${sigInfo.status}`}
                </DropdownMenuItem>
              )}
              {participant.signed_convention_url && (
                <DropdownMenuItem disabled className="text-xs opacity-70">
                  <FileSignature className="h-4 w-4 mr-2" />Convention signée
                </DropdownMenuItem>
              )}
              {canSendConventionReminderFor(participant) && (
                <DropdownMenuItem onClick={() => onSendConventionReminder(participant)} disabled={conventionRemindingId === participant.id}>
                  {conventionRemindingId === participant.id ? <Spinner className="mr-2" /> : <BellRing className="h-4 w-4 mr-2" />}
                  Relancer convention
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

      {/* 1b. Statut compte e-learning + renvoi du lien magique - e-learning uniquement */}
      {formatFormation === "e_learning" && (() => {
        const hasAccount = participantsWithAccount.has(participant.id);
        const isSending = sendingMagicLinkId === participant.id;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${hasAccount ? "text-green-600 hover:text-green-700" : "text-destructive hover:text-destructive"}`}
                onClick={() => onSendMagicLink(participant)}
                disabled={isSending}
              >
                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasAccount ? "Compte e-learning créé — renvoyer le lien magique" : "Compte non créé — renvoyer le lien magique"}</p>
            </TooltipContent>
          </Tooltip>
        );
      })()}

      {/* 2. Questionnaire des besoins */}
      {(participant.needs_survey_status === "complete" || participant.needs_survey_status === "valide_formateur") && (
        <ViewQuestionnaireDialog participantId={participant.id} participantName={displayName} trainingId={trainingId} />
      )}
      {canSendSurveyFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onSendSurvey(participant)} disabled={sendingId === participant.id}>
              {sendingId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Envoyer le questionnaire</p></TooltipContent>
        </Tooltip>
      )}
      {canSendReminderFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onSendReminder(participant)} disabled={remindingId === participant.id}>
              {remindingId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Relancer recueil des besoins</p></TooltipContent>
        </Tooltip>
      )}

      {/* 3. Evaluation */}
      {(() => {
        const evalInfo = evaluationsByParticipant.get(participant.id);
        if (!evalInfo) return null;
        if (evalInfo.etat === "soumis") {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => { if (evalInfo.fullData) { onViewEvaluation(evalInfo.fullData); } }}>
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Évaluation soumise{evalInfo.appreciation_generale ? ` — ${evalInfo.appreciation_generale}/5` : ""}</p></TooltipContent>
            </Tooltip>
          );
        }
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center h-7 w-7">
                <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground/50" />
              </span>
            </TooltipTrigger>
            <TooltipContent><p>Évaluation {evalInfo.etat === "envoye" ? "en attente" : evalInfo.etat}</p></TooltipContent>
          </Tooltip>
        );
      })()}

      {/* 4. Attestation */}
      {(() => {
        const cert = certificatesByParticipant.get(participant.id);
        const hasCert = !!cert?.certificateUrl;
        const sponsorEmail = participant.sponsor_email;
        const sponsorName = [participant.sponsor_first_name, participant.sponsor_last_name].filter(Boolean).join(" ");

        if (!hasCert) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" disabled={generatingCertId === participant.id} onClick={() => onGenerateCertificate(participant)}>
                  {generatingCertId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Générer l'attestation</p></TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" disabled={sendingCertId === participant.id}>
                    {sendingCertId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Attestation</p></TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(cert!.certificateUrl!, "_blank")}>
                <Download className="h-4 w-4 mr-2" />Télécharger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendCertificate(participant, participant.email, participant.first_name || "")}>
                <Forward className="h-4 w-4 mr-2" />Envoyer au participant
              </DropdownMenuItem>
              {sponsorEmail && (
                <DropdownMenuItem onClick={() => onSendCertificate(participant, sponsorEmail, sponsorName)}>
                  <UserCheck className="h-4 w-4 mr-2" />Envoyer au commanditaire
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

      {/* 5. Documents/Facture - inter only */}
      {isInterEntreprise && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${participant.payment_mode === "online" || participant.invoice_file_url ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              onClick={() => onOpenDocuments(participant)}
            >
              <Receipt className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{participant.payment_mode === "online" ? "Payé en ligne" : participant.invoice_file_url ? "Facture uploadée" : "Gérer la facture"}</p></TooltipContent>
        </Tooltip>
      )}

      {/* 6. Traceability Qualiopi */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onOpenTraceability(participant)}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Traçabilité participant</p></TooltipContent>
      </Tooltip>

      {/* 7. Edit (contient aussi le bouton Repositionner pour inter/e-learning) */}
      <EditParticipantDialog
        participant={participant}
        trainingId={trainingId}
        formatFormation={formatFormation}
        isInterEntreprise={isInterEntreprise}
        availableFormulas={availableFormulas}
        trainingDuree={trainingDuree}
        trainingDates={[trainingStartDate, trainingEndDate]}
        trainingLocation={trainingLocation}
        onParticipantUpdated={onParticipantUpdated}
      />

      {/* 8. Delete */}
      {participantsWithSignatures.has(participant.id) ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground cursor-not-allowed opacity-50" disabled>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent><p>Émargement signé — suppression impossible</p></TooltipContent>
        </Tooltip>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={deletingId === participant.id}>
              {deletingId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce participant ?</AlertDialogTitle>
              <AlertDialogDescription>
                {displayName} sera définitivement retiré de cette formation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(participant)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default React.memo(ParticipantActions);
