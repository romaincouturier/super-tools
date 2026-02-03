import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle, Trash2, Loader2, Send, RefreshCw, Receipt, Building } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import ViewQuestionnaireDialog from "./ViewQuestionnaireDialog";
import ParticipantDocumentsDialog from "./ParticipantDocumentsDialog";

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
}

interface ParticipantListProps {
  participants: Participant[];
  trainingId: string;
  trainingName: string;
  trainingStartDate: string;
  trainingEndDate: string | null;
  formatFormation: string | null;
  attendanceSheetsUrls: string[];
  onParticipantUpdated: () => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "non_envoye":
      return {
        label: "Non envoyé",
        icon: Mail,
        variant: "secondary" as const,
        tooltip: "Le questionnaire n'a pas encore été envoyé",
      };
    case "programme":
      return {
        label: "Recueil programmé",
        icon: Clock,
        variant: "outline" as const,
        tooltip: "Le mail d'accueil a été envoyé, l'envoi du questionnaire de recueil est programmé",
      };
    case "manuel":
      return {
        label: "Mode manuel",
        icon: AlertTriangle,
        variant: "secondary" as const,
        tooltip: "Formation trop proche, envoi manuel requis",
      };
    case "envoye":
      return {
        label: "Envoyé",
        icon: MailCheck,
        variant: "outline" as const,
        tooltip: "Le questionnaire a été envoyé, en attente de réponse",
      };
    case "accueil_envoye":
      return {
        label: "Accueil envoyé",
        icon: MailCheck,
        variant: "outline" as const,
        tooltip: "Le mail d'accueil a été envoyé (J-7)",
      };
    case "en_cours":
      return {
        label: "En cours",
        icon: Clock,
        variant: "default" as const,
        tooltip: "Le participant a commencé à remplir le questionnaire",
      };
    case "complete":
      return {
        label: "Complété",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le questionnaire a été complété",
      };
    case "valide_formateur":
      return {
        label: "Validé",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le formateur a validé les réponses",
      };
    case "expire":
      return {
        label: "Expiré",
        icon: AlertTriangle,
        variant: "destructive" as const,
        tooltip: "Le lien du questionnaire a expiré",
      };
    default:
      return {
        label: status,
        icon: HelpCircle,
        variant: "secondary" as const,
        tooltip: "Statut inconnu",
      };
  }
};

const ParticipantList = ({ 
  participants, 
  trainingId, 
  trainingName,
  trainingStartDate, 
  trainingEndDate,
  formatFormation,
  attendanceSheetsUrls,
  onParticipantUpdated 
}: ParticipantListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [documentsParticipant, setDocumentsParticipant] = useState<Participant | null>(null);
  const { toast } = useToast();
  
  const isInterEntreprise = formatFormation === "inter-entreprises";

  // Check if we're at J-2 or later
  const daysUntilTraining = differenceInDays(parseISO(trainingStartDate), new Date());
  const canSendManually = daysUntilTraining <= 2;

  const handleDelete = async (participant: Participant) => {
    setDeletingId(participant.id);
    try {
      // Delete related questionnaire_besoins first (if any)
      await supabase
        .from("questionnaire_besoins")
        .delete()
        .eq("participant_id", participant.id);

      // Delete the participant
      const { error } = await supabase
        .from("training_participants")
        .delete()
        .eq("id", participant.id);

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "participant_removed",
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
        },
      });

      toast({
        title: "Participant supprimé",
        description: `${participant.email} a été retiré de la formation.`,
      });

      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error deleting participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le participant.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendSurvey = async (participant: Participant) => {
    setSendingId(participant.id);
    try {
      const { error } = await supabase.functions.invoke("send-needs-survey", {
        body: { participantId: participant.id, trainingId },
      });

      if (error) throw error;

      toast({
        title: "Questionnaire envoyé",
        description: `Le questionnaire a été envoyé à ${participant.email}.`,
      });

      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error sending survey:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le questionnaire.",
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendReminder = async (participant: Participant) => {
    setRemindingId(participant.id);
    try {
      const { error } = await supabase.functions.invoke("send-needs-survey-reminder", {
        body: { participantId: participant.id, trainingId },
      });

      if (error) throw error;

      toast({
        title: "Relance envoyée",
        description: `Une relance a été envoyée à ${participant.email}.`,
      });

      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error sending reminder:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la relance.",
        variant: "destructive",
      });
    } finally {
      setRemindingId(null);
    }
  };

  // Check if survey can be sent for a participant
  const canSendSurveyFor = (participant: Participant) => {
    const status = participant.needs_survey_status;
    // Can send if manual mode, not sent, or needs to be resent
    return canSendManually && (status === "manuel" || status === "non_envoye" || status === "programme");
  };

  // Check if reminder can be sent for a participant (questionnaire sent but not completed)
  const canSendReminderFor = (participant: Participant) => {
    const status = participant.needs_survey_status;
    return status === "envoye" || status === "accueil_envoye" || status === "en_cours";
  };

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Aucun participant inscrit</p>
        <p className="text-sm">Ajoutez des participants pour commencer</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Société</TableHead>
            {isInterEntreprise && <TableHead>Commanditaire</TableHead>}
            <TableHead>Recueil des besoins</TableHead>
            <TableHead className="w-28"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((participant) => {
            const statusConfig = getStatusConfig(participant.needs_survey_status);
            const StatusIcon = statusConfig.icon;
            const displayName = participant.first_name || participant.last_name
              ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
              : participant.email;
            
            const sponsorDisplayName = participant.sponsor_first_name || participant.sponsor_last_name
              ? `${participant.sponsor_first_name || ""} ${participant.sponsor_last_name || ""}`.trim()
              : null;

            return (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {participant.first_name || participant.last_name
                      ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                      : "—"}
                    {isInterEntreprise && participant.payment_mode === "invoice" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>À facturer après la formation</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>{participant.email}</TableCell>
                <TableCell>{participant.company || "—"}</TableCell>
                {isInterEntreprise && (
                  <TableCell>
                    {sponsorDisplayName || participant.sponsor_email ? (
                      <div className="flex flex-col gap-0.5">
                        {sponsorDisplayName && (
                          <span className="text-sm">{sponsorDisplayName}</span>
                        )}
                        {participant.sponsor_email && (
                          <span className="text-xs text-muted-foreground">{participant.sponsor_email}</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={statusConfig.variant}
                        className="cursor-help gap-1"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{statusConfig.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {/* Documents button - only for inter-enterprise */}
                    {isInterEntreprise && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${participant.invoice_file_url ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                            onClick={() => setDocumentsParticipant(participant)}
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{participant.invoice_file_url ? "Facture uploadée - Gérer les documents" : "Gérer la facture"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* View questionnaire button - only for completed status */}
                    {(participant.needs_survey_status === "complete" || participant.needs_survey_status === "valide_formateur") && (
                      <ViewQuestionnaireDialog
                        participantId={participant.id}
                        participantName={displayName}
                        trainingId={trainingId}
                      />
                    )}
                    
                    {canSendSurveyFor(participant) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleSendSurvey(participant)}
                            disabled={sendingId === participant.id}
                          >
                            {sendingId === participant.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Envoyer le questionnaire</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Reminder button - always visible for sent/in-progress statuses */}
                    {canSendReminderFor(participant) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleSendReminder(participant)}
                            disabled={remindingId === participant.id}
                          >
                            {remindingId === participant.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Relancer pour recueillir le besoin</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === participant.id}
                        >
                          {deletingId === participant.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce participant ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {displayName} sera définitivement retiré de cette formation.
                            Ses réponses au questionnaire seront également supprimées.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(participant)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {/* Documents dialog for inter-enterprise */}
      {documentsParticipant && (
        <ParticipantDocumentsDialog
          open={!!documentsParticipant}
          onOpenChange={(open) => !open && setDocumentsParticipant(null)}
          participant={{
            id: documentsParticipant.id,
            first_name: documentsParticipant.first_name,
            last_name: documentsParticipant.last_name,
            email: documentsParticipant.email,
            company: documentsParticipant.company,
            sponsor_first_name: documentsParticipant.sponsor_first_name || null,
            sponsor_last_name: documentsParticipant.sponsor_last_name || null,
            sponsor_email: documentsParticipant.sponsor_email || null,
            invoice_file_url: documentsParticipant.invoice_file_url || null,
          }}
          trainingId={trainingId}
          trainingName={trainingName}
          startDate={trainingStartDate}
          endDate={trainingEndDate}
          attendanceSheetsUrls={attendanceSheetsUrls}
          onUpdate={onParticipantUpdated}
        />
      )}
    </>
  );
};

export default ParticipantList;
