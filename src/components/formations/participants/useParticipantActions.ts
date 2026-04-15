import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { logActivity } from "@/services/activityLog";
import type { Participant, ConventionSignatureInfo } from "./types";
import type { CertificateInfo as CertInfo } from "@/lib/evaluationUtils";
import { useDocumentActions } from "./useDocumentActions";

interface UseParticipantActionsParams {
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  clientName: string;
  trainingDuree: string;
  certificatesByParticipant: Map<string, CertInfo>;
  conventionSignatures: Map<string, ConventionSignatureInfo>;
  isIndividualConvention: boolean;
  canSendManually: boolean;
  onParticipantUpdated: () => void;
}

export function useParticipantActions({
  trainingId,
  trainingName,
  trainingStartDate,
  trainingEndDate,
  clientName,
  trainingDuree,
  certificatesByParticipant,
  conventionSignatures,
  isIndividualConvention,
  canSendManually,
  onParticipantUpdated,
}: UseParticipantActionsParams) {
  const { toast } = useToast();
  const { copy } = useCopyToClipboard();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const documentActions = useDocumentActions({
    trainingId,
    trainingName,
    trainingStartDate,
    trainingEndDate,
    clientName,
    trainingDuree,
    certificatesByParticipant,
    onParticipantUpdated,
  });

  const handleDelete = async (participant: Participant) => {
    setDeletingId(participant.id);
    try {
      await supabase
        .from("questionnaire_besoins")
        .delete()
        .eq("participant_id", participant.id);

      const { error } = await supabase
        .from("training_participants")
        .delete()
        .eq("id", participant.id);

      if (error) throw error;

      await logActivity({
        actionType: "participant_removed",
        recipientEmail: participant.email,
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
    } catch (error: unknown) {
      console.error("Error deleting participant:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
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
    } catch (error: unknown) {
      console.error("Error sending survey:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
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
    } catch (error: unknown) {
      console.error("Error sending reminder:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setRemindingId(null);
    }
  };

  const handleToggleCoachingSession = async (participant: Participant) => {
    const current = participant.coaching_sessions_completed || 0;
    const total = participant.coaching_sessions_total || 0;
    const newCompleted = current < total ? current + 1 : current - 1;
    const { error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("training_participants")
      .update({ coaching_sessions_completed: Math.max(0, newCompleted) })
      .eq("id", participant.id);
    if (!error) onParticipantUpdated();
  };

  const handleUncheckCoachingSession = async (participant: Participant) => {
    const current = participant.coaching_sessions_completed || 0;
    if (current <= 0) return;
    const { error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("training_participants")
      .update({ coaching_sessions_completed: current - 1 })
      .eq("id", participant.id);
    if (!error) onParticipantUpdated();
  };

  const handleCopyEmail = (email: string) => {
    copy(email, { title: "Email copié", description: email });
  };

  const canSendConventionReminderFor = (participant: Participant) => {
    if (!isIndividualConvention) return false;
    if (!participant.convention_file_url) return false;
    if (participant.signed_convention_url) return false;
    if (participant.payment_mode === "online") return false;
    const sigInfo = conventionSignatures.get(participant.id);
    if (sigInfo?.status === "signed") return false;
    return true;
  };

  const canSendSurveyFor = (participant: Participant) => {
    const status = participant.needs_survey_status;
    return canSendManually && (status === "manuel" || status === "non_envoye" || status === "programme");
  };

  const canSendReminderFor = (participant: Participant) => {
    const status = participant.needs_survey_status;
    return status === "envoye" || status === "accueil_envoye" || status === "en_cours";
  };

  return {
    deletingId,
    sendingId,
    remindingId,
    ...documentActions,
    handleDelete,
    handleSendSurvey,
    handleSendReminder,
    handleToggleCoachingSession,
    handleUncheckCoachingSession,
    handleCopyEmail,
    canSendConventionReminderFor,
    canSendSurveyFor,
    canSendReminderFor,
  };
}
