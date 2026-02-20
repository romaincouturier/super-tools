import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle, Trash2, Loader2, Send, RefreshCw, Receipt, Building, Scroll, Award, Download, Forward, UserCheck, RotateCw, FileSignature, Eye, BellRing, StickyNote, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ViewQuestionnaireDialog from "./ViewQuestionnaireDialog";
import ParticipantDocumentsDialog from "./ParticipantDocumentsDialog";
import EditParticipantDialog from "./EditParticipantDialog";

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
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  convention_file_url?: string | null;
  convention_document_id?: string | null;
  signed_convention_url?: string | null;
  elearning_duration?: number | null;
  notes?: string | null;
}

interface ParticipantListProps {
  participants: Participant[];
  trainingId: string;
  trainingName: string;
  trainingStartDate: string;
  trainingEndDate: string | null;
  formatFormation: string | null;
  elearningDuration?: number | null;
  attendanceSheetsUrls: string[];
  clientName: string;
  trainingDuree: string;
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

interface CertificateInfo {
  evaluationId: string;
  certificateUrl: string | null;
}

interface ConventionSignatureInfo {
  status: string;
  signed_at: string | null;
}

const ParticipantList = ({
  participants,
  trainingId,
  trainingName,
  trainingStartDate,
  trainingEndDate,
  formatFormation,
  elearningDuration,
  attendanceSheetsUrls,
  clientName,
  trainingDuree,
  onParticipantUpdated
}: ParticipantListProps) => {
  const isMobile = useIsMobile();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [generatingConventionId, setGeneratingConventionId] = useState<string | null>(null);
  const [documentsParticipant, setDocumentsParticipant] = useState<Participant | null>(null);
  const [certificatesByParticipant, setCertificatesByParticipant] = useState<Map<string, CertificateInfo>>(new Map());
  const [conventionSignatures, setConventionSignatures] = useState<Map<string, ConventionSignatureInfo>>(new Map());
  const [sendingCertId, setSendingCertId] = useState<string | null>(null);
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const [downloadingConventionId, setDownloadingConventionId] = useState<string | null>(null);
  const [conventionRemindingId, setConventionRemindingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"last_name" | "first_name" | "email" | "amount" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  const isInterEntreprise = formatFormation === "inter-entreprises" || formatFormation === "e_learning";
  const isIndividualConvention = formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // Fetch evaluation certificate URLs for all participants
  useEffect(() => {
    const fetchCertificates = async () => {
      const { data, error } = await (supabase as any)
        .from("training_evaluations")
        .select("id, participant_id, certificate_url, etat")
        .eq("training_id", trainingId)
        .eq("etat", "soumis");

      if (!error && data) {
        const map = new Map<string, CertificateInfo>();
        for (const ev of data) {
          if (ev.participant_id) {
            map.set(ev.participant_id, {
              evaluationId: ev.id,
              certificateUrl: ev.certificate_url || null,
            });
          }
        }
        setCertificatesByParticipant(map);
      }
    };
    fetchCertificates();
  }, [trainingId, participants]);

  // Fetch convention signature statuses for inter/e-learning participants
  useEffect(() => {
    if (!isIndividualConvention) return;
    
    const fetchConventionSignatures = async () => {
      const sponsorEmails = participants
        .filter(p => p.sponsor_email)
        .map(p => p.sponsor_email!);
      
      if (sponsorEmails.length === 0) return;

      const { data, error } = await (supabase as any)
        .from("convention_signatures")
        .select("recipient_email, status, signed_at")
        .eq("training_id", trainingId)
        .in("recipient_email", sponsorEmails);

      if (!error && data) {
        const map = new Map<string, ConventionSignatureInfo>();
        // Map signature status back to participant via sponsor_email
        for (const sig of data) {
          // Find participant(s) with this sponsor email
          for (const p of participants) {
            if (p.sponsor_email === sig.recipient_email) {
              map.set(p.id, {
                status: sig.status,
                signed_at: sig.signed_at,
              });
            }
          }
        }
        setConventionSignatures(map);
      }
    };
    fetchConventionSignatures();
  }, [trainingId, participants, isIndividualConvention]);

  // Download convention with URL refresh fallback
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
        // URL expired, refresh via PDFMonkey
        toast({
          title: "URL expirée",
          description: "Veuillez ré-générer la convention pour obtenir un nouveau lien.",
          variant: "destructive",
        });
      } else {
        throw new Error(`Erreur ${response.status}`);
      }
    } catch (error: any) {
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
    recipientName: string
  ) => {
    const cert = certificatesByParticipant.get(participant.id);
    if (!cert) return;

    setSendingCertId(participant.id);
    try {
      const { error } = await supabase.functions.invoke("send-certificate-email", {
        body: {
          evaluationId: cert.evaluationId,
          recipientEmail,
          recipientName,
        },
      });

      if (error) throw error;

      toast({
        title: "Certificat envoyé",
        description: `Le certificat a été envoyé à ${recipientEmail}.`,
      });
    } catch (error: any) {
      console.error("Error sending certificate:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le certificat.",
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

      // Read the stream to completion
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
        // Check for errors in the stream
        const lines = buffer.split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "complete" && event.data.successCount === 0) {
              throw new Error("La génération du certificat a échoué.");
            }
          } catch (parseErr) {
            // ignore parse errors
          }
        }
      }

      toast({
        title: "Attestation générée",
        description: `L'attestation a été générée et envoyée à ${participant.email}.`,
      });

      // Refresh certificates list
      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error generating certificate:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer l'attestation.",
        variant: "destructive",
      });
    } finally {
      setGeneratingCertId(null);
    }
  };

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

  const handleGenerateConvention = async (participant: Participant) => {
    setGeneratingConventionId(participant.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
        body: {
          trainingId,
          participantId: participant.id,
          subrogation: false,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.pdfUrl) {
        // If participant has a sponsor email, send the convention automatically
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
          } catch (sendErr: any) {
            console.error("Error sending convention:", sendErr);
            toast({
              title: "Convention générée",
              description: `Convention générée mais erreur à l'envoi : ${sendErr.message || "erreur inconnue"}`,
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

      // Refresh participant data so convention URL is reflected in UI
      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error generating convention:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer la convention.",
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
    } catch (error: any) {
      console.error("Error sending convention reminder:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la relance convention.",
        variant: "destructive",
      });
    } finally {
      setConventionRemindingId(null);
    }
  };

  // Check if convention reminder can be sent for a participant
  const canSendConventionReminderFor = (participant: Participant) => {
    if (!isIndividualConvention) return false;
    if (!participant.convention_file_url) return false; // Convention not generated
    if (participant.signed_convention_url) return false; // Already signed (manual upload)
    if (participant.payment_mode === "online") return false; // Already paid

    const sigInfo = conventionSignatures.get(participant.id);
    if (sigInfo?.status === "signed") return false; // Already signed electronically

    return true; // Convention generated but not signed
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

  const toggleSort = (field: "last_name" | "first_name" | "email" | "amount") => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortField(null); setSortDirection("asc"); }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "last_name":
        return dir * (a.last_name || "").localeCompare(b.last_name || "", "fr");
      case "first_name":
        return dir * (a.first_name || "").localeCompare(b.first_name || "", "fr");
      case "email":
        return dir * a.email.localeCompare(b.email, "fr");
      case "amount":
        return dir * ((a.sold_price_ht || 0) - (b.sold_price_ht || 0));
      default:
        return 0;
    }
  });

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Aucun participant inscrit</p>
        <p className="text-sm">Ajoutez des participants pour commencer</p>
      </div>
    );
  }

  // Helper to render action buttons for a participant (shared between mobile and desktop)
  const renderParticipantActions = (participant: Participant, displayName: string) => (
    <div className="flex items-center gap-1 flex-wrap">
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

      {/* Convention button - for inter-enterprise and e-learning */}
      {isIndividualConvention && (() => {
        const hasConvention = !!participant.convention_file_url;
        const sigInfo = conventionSignatures.get(participant.id);
        const isLoading = generatingConventionId === participant.id || downloadingConventionId === participant.id;

        if (!hasConvention) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleGenerateConvention(participant)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scroll className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Générer la convention de formation</p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Scroll className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleDownloadConvention(participant)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger la convention
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleGenerateConvention(participant)}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Ré-générer la convention
              </DropdownMenuItem>
              {sigInfo && !participant.signed_convention_url && (
                <DropdownMenuItem disabled className="text-xs opacity-70">
                  <FileSignature className="h-4 w-4 mr-2" />
                  {sigInfo.status === "signed"
                    ? `Signée le ${new Date(sigInfo.signed_at!).toLocaleDateString("fr-FR")}`
                    : sigInfo.status === "pending"
                      ? "En attente de signature"
                      : `Signature : ${sigInfo.status}`}
                </DropdownMenuItem>
              )}
              {participant.signed_convention_url && (
                <DropdownMenuItem disabled className="text-xs opacity-70">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Convention signée (upload manuel)
                </DropdownMenuItem>
              )}
              {canSendConventionReminderFor(participant) && (
                <DropdownMenuItem
                  onClick={() => handleSendConventionReminder(participant)}
                  disabled={conventionRemindingId === participant.id}
                >
                  {conventionRemindingId === participant.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellRing className="h-4 w-4 mr-2" />
                  )}
                  Relancer pour la convention
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

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

      {/* Attestation / Certificate button */}
      {(() => {
        const cert = certificatesByParticipant.get(participant.id);
        const hasCert = !!cert?.certificateUrl;
        const sponsorEmail = participant.sponsor_email;
        const sponsorName = [participant.sponsor_first_name, participant.sponsor_last_name]
          .filter(Boolean)
          .join(" ");

        if (!hasCert) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  disabled={generatingCertId === participant.id}
                  onClick={() => handleGenerateCertificate(participant)}
                >
                  {generatingCertId === participant.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Générer et envoyer l'attestation</p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                disabled={sendingCertId === participant.id}
              >
                {sendingCertId === participant.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Award className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => window.open(cert!.certificateUrl!, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger l'attestation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSendCertificate(
                  participant,
                  participant.email,
                  participant.first_name || ""
                )}
              >
                <Forward className="h-4 w-4 mr-2" />
                Envoyer au participant
              </DropdownMenuItem>
              {sponsorEmail && (
                <DropdownMenuItem
                  onClick={() => handleSendCertificate(
                    participant,
                    sponsorEmail,
                    sponsorName
                  )}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Envoyer au commanditaire
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

      {/* Edit participant button */}
      <EditParticipantDialog
        participant={participant}
        trainingId={trainingId}
        formatFormation={formatFormation}
        trainingElearningDuration={elearningDuration}
        onParticipantUpdated={onParticipantUpdated}
      />

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
  );

  return (
    <>
      {isMobile ? (
        /* Mobile: card list for participants */
        <div className="space-y-3">
          {sortedParticipants.map((participant) => {
            const statusConfig = getStatusConfig(participant.needs_survey_status);
            const StatusIcon = statusConfig.icon;
            const displayName = participant.first_name || participant.last_name
              ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
              : participant.email;

            return (
              <div key={participant.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {participant.first_name || participant.last_name
                        ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                    {participant.company && (
                      <p className="text-xs text-muted-foreground">{participant.company}</p>
                    )}
                  </div>
                  <Badge
                    variant={statusConfig.variant}
                    className="gap-1 text-xs shrink-0"
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
                {isInterEntreprise && participant.sold_price_ht != null && (
                  <p className="text-xs text-muted-foreground">
                    {participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                    {participant.payment_mode === "invoice" && (
                      <span className="ml-1.5 text-amber-600">• À facturer</span>
                    )}
                  </p>
                )}
                {renderParticipantActions(participant, displayName)}
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop: table */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button onClick={() => toggleSort("last_name")} className="flex items-center hover:text-foreground transition-colors">
                  Nom <SortIcon field="last_name" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("email")} className="flex items-center hover:text-foreground transition-colors">
                  Email <SortIcon field="email" />
                </button>
              </TableHead>
              <TableHead>Société</TableHead>
              {isInterEntreprise && <TableHead>Commanditaire</TableHead>}
              {isInterEntreprise && (
                <TableHead>
                  <button onClick={() => toggleSort("amount")} className="flex items-center hover:text-foreground transition-colors">
                    Montant HT <SortIcon field="amount" />
                  </button>
                </TableHead>
              )}
              <TableHead>Recueil des besoins</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParticipants.map((participant) => {
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
                      {isInterEntreprise && participant.notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs whitespace-pre-wrap">{participant.notes}</p>
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
                  {isInterEntreprise && (
                    <TableCell>
                      {participant.sold_price_ht != null
                        ? `${participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                        : "—"}
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
                    {renderParticipantActions(participant, displayName)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      
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
