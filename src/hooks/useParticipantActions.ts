import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  convention_file_url?: string | null;
  convention_document_id?: string | null;
  signed_convention_url?: string | null;
  payment_mode?: string;
}

interface UseParticipantActionsOptions {
  trainingId: string;
  trainingName: string;
  trainingStartDate: string;
  trainingEndDate: string | null;
  clientName: string;
  trainingDuree: string;
  onParticipantUpdated: () => void;
}

export function useParticipantActions({
  trainingId,
  trainingName,
  trainingStartDate,
  trainingEndDate,
  clientName,
  trainingDuree,
  onParticipantUpdated,
}: UseParticipantActionsOptions) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [generatingConventionId, setGeneratingConventionId] = useState<string | null>(null);
  const [sendingCertId, setSendingCertId] = useState<string | null>(null);
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const [downloadingConventionId, setDownloadingConventionId] = useState<string | null>(null);
  const [conventionRemindingId, setConventionRemindingId] = useState<string | null>(null);
  const { toast } = useToast();

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
    } catch (error: unknown) {
      console.error("Error deleting participant:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le participant.",
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
        description: error instanceof Error ? error.message : "Impossible d'envoyer le questionnaire.",
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
        description: error instanceof Error ? error.message : "Impossible d'envoyer la relance.",
        variant: "destructive",
      });
    } finally {
      setRemindingId(null);
    }
  };

  const handleDownloadConvention = async (participant: Participant) => {
    if (!participant.convention_file_url) return;
    setDownloadingConventionId(participant.id);
    try {
      const response = await fetch(participant.convention_file_url);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Convention_${(participant.company || "").replace(/\s+/g, "_")}_${(participant.first_name || "").replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (response.status === 403 && participant.convention_document_id) {
        toast({
          title: "URL expirée",
          description: "Veuillez ré-générer la convention pour obtenir un nouveau lien.",
          variant: "destructive",
        });
      } else {
        throw new Error(`Erreur ${response.status}`);
      }
    } catch (error: unknown) {
      console.error("Error downloading convention:", error);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger la convention. Essayez de la ré-générer.",
        variant: "destructive",
      });
    } finally {
      setDownloadingConventionId(null);
    }
  };

  const handleSendCertificate = async (
    participant: Participant,
    recipientEmail: string,
    recipientName: string,
    evaluationId: string,
  ) => {
    setSendingCertId(participant.id);
    try {
      const { error } = await supabase.functions.invoke("send-certificate-email", {
        body: { evaluationId, recipientEmail, recipientName },
      });

      if (error) throw error;

      toast({
        title: "Certificat envoyé",
        description: `Le certificat a été envoyé à ${recipientEmail}.`,
      });
    } catch (error: unknown) {
      console.error("Error sending certificate:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le certificat.",
        variant: "destructive",
      });
    } finally {
      setSendingCertId(null);
    }
  };

  const handleGenerateCertificate = async (participant: Participant) => {
    setGeneratingCertId(participant.id);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            formationName: trainingName,
            entreprise: clientName || "",
            duree: trainingDuree,
            dateDebut: trainingStartDate,
            dateFin: trainingEndDate || trainingStartDate,
            emailDestinataire: session.data.session?.user?.email || "",
            participants: [{
              prenom: participant.first_name || "",
              nom: participant.last_name || "",
              email: participant.email,
            }],
            userId: session.data.session?.user?.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
        const lines = buffer.split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "complete" && event.data.successCount === 0) {
              throw new Error("La génération du certificat a échoué.");
            }
          } catch {
            // skip non-JSON lines in SSE stream
          }
        }
      }

      toast({
        title: "Attestation générée",
        description: `L'attestation a été générée et envoyée à ${participant.email}.`,
      });

      onParticipantUpdated();
    } catch (error: unknown) {
      console.error("Error generating certificate:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer l'attestation.",
        variant: "destructive",
      });
    } finally {
      setGeneratingCertId(null);
    }
  };

  const handleGenerateConvention = async (participant: Participant) => {
    setGeneratingConventionId(participant.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
        body: { trainingId, participantId: participant.id, subrogation: false },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.pdfUrl) {
        if (participant.sponsor_email) {
          try {
            const sponsorName = [participant.sponsor_first_name, participant.sponsor_last_name]
              .filter(Boolean)
              .join(" ") || null;

            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-convention-email", {
              body: {
                trainingId,
                conventionUrl: data.pdfUrl,
                recipientEmail: participant.sponsor_email,
                recipientName: sponsorName,
                recipientFirstName: participant.sponsor_first_name || null,
                formalAddress: true,
                conventionFileName: data.fileName || null,
                enableOnlineSignature: true,
              },
            });

            if (sendError) throw sendError;
            if (sendData?.error) throw new Error(sendData.error);

            toast({
              title: "Convention générée et envoyée",
              description: `La convention pour ${participant.first_name || participant.email} a été envoyée à ${participant.sponsor_email}.`,
            });
          } catch (sendErr: unknown) {
            console.error("Error sending convention:", sendErr);
            toast({
              title: "Convention générée",
              description: `Convention générée mais erreur à l'envoi : ${sendErr instanceof Error ? sendErr.message : "erreur inconnue"}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Convention générée",
            description: `La convention pour ${participant.first_name || participant.email} a été générée. Aucun commanditaire défini pour l'envoi.`,
          });
        }
      }

      onParticipantUpdated();
    } catch (error: unknown) {
      console.error("Error generating convention:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer la convention.",
        variant: "destructive",
      });
    } finally {
      setGeneratingConventionId(null);
    }
  };

  const handleSendConventionReminder = async (participant: Participant) => {
    setConventionRemindingId(participant.id);
    try {
      const { error } = await supabase.functions.invoke("send-convention-reminder", {
        body: { trainingId, participantId: participant.id },
      });

      if (error) throw error;

      toast({
        title: "Relance envoyée",
        description: `Une relance convention a été envoyée pour ${participant.first_name || participant.email}.`,
      });
    } catch (error: unknown) {
      console.error("Error sending convention reminder:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la relance convention.",
        variant: "destructive",
      });
    } finally {
      setConventionRemindingId(null);
    }
  };

  return {
    // Loading states
    deletingId,
    sendingId,
    remindingId,
    generatingConventionId,
    sendingCertId,
    generatingCertId,
    downloadingConventionId,
    conventionRemindingId,

    // Actions
    handleDelete,
    handleSendSurvey,
    handleSendReminder,
    handleDownloadConvention,
    handleSendCertificate,
    handleGenerateCertificate,
    handleGenerateConvention,
    handleSendConventionReminder,
  };
}
