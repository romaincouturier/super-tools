import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import type { Participant } from "./types";
import type { CertificateInfo as CertInfo } from "@/lib/evaluationUtils";

interface UseDocumentActionsParams {
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  clientName: string;
  trainingDuree: string;
  certificatesByParticipant: Map<string, CertInfo>;
  onParticipantUpdated: () => void;
}

export function useDocumentActions({
  trainingId,
  trainingName,
  trainingStartDate,
  trainingEndDate,
  clientName,
  trainingDuree,
  certificatesByParticipant,
  onParticipantUpdated,
}: UseDocumentActionsParams) {
  const { toast } = useToast();
  const [generatingConventionId, setGeneratingConventionId] = useState<string | null>(null);
  const [downloadingConventionId, setDownloadingConventionId] = useState<string | null>(null);
  const [conventionRemindingId, setConventionRemindingId] = useState<string | null>(null);
  const [sendingCertId, setSendingCertId] = useState<string | null>(null);
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const { invoke: invokeSendCertificate } = useEdgeFunction(
    "send-certificate-email",
    { errorMessage: "Erreur" },
  );
  const { invoke: invokeConventionReminder } = useEdgeFunction(
    "send-convention-reminder",
    { errorMessage: "Erreur" },
  );

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
  ) => {
    const cert = certificatesByParticipant.get(participant.id);
    if (!cert) return;

    setSendingCertId(participant.id);
    try {
      const result = await invokeSendCertificate({
        evaluationId: cert.evaluationId,
        recipientEmail,
        recipientName,
      });
      if (result !== null) {
        toast({ title: "Certificat envoyé", description: `Le certificat a été envoyé à ${recipientEmail}.` });
      }
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
            dateDebut: trainingStartDate || "",
            dateFin: trainingEndDate || trainingStartDate || "",
            emailDestinataire: session.data.session?.user?.email || "",
            participants: [{
              prenom: participant.first_name || "",
              nom: participant.last_name || "",
              email: participant.email,
              participantId: participant.id,
            }],
            userId: session.data.session?.user?.id,
            trainingId,
          }),
        },
      );

      if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

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
          } catch (parseErr: unknown) {
            // ignore parse errors from non-JSON lines
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
        description: error instanceof Error ? error.message : "Erreur inconnue",
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
              .filter(Boolean).join(" ") || null;
            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-convention-email", {
              body: {
                trainingId, conventionUrl: data.pdfUrl,
                recipientEmail: participant.sponsor_email, recipientName: sponsorName,
                recipientFirstName: participant.sponsor_first_name || null,
                formalAddress: true, conventionFileName: data.fileName || null,
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
              description: `Convention générée mais erreur à l'envoi : ${sendErr instanceof Error ? sendErr.message : "Erreur inconnue"}`,
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
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setGeneratingConventionId(null);
    }
  };

  const handleSendConventionReminder = async (participant: Participant) => {
    setConventionRemindingId(participant.id);
    try {
      const result = await invokeConventionReminder({ trainingId, participantId: participant.id });
      if (result !== null) {
        toast({
          title: "Relance envoyée",
          description: `Une relance convention a été envoyée pour ${participant.first_name || participant.email}.`,
        });
      }
    } finally {
      setConventionRemindingId(null);
    }
  };

  return {
    generatingConventionId,
    downloadingConventionId,
    conventionRemindingId,
    sendingCertId,
    generatingCertId,
    handleDownloadConvention,
    handleSendCertificate,
    handleGenerateCertificate,
    handleGenerateConvention,
    handleSendConventionReminder,
  };
}
