import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle, Trash2, Loader2, Send, RefreshCw, Receipt, Building, Scroll, Award, Download, Forward, UserCheck, RotateCw, FileSignature, Eye, BellRing, StickyNote, ArrowUpDown, ArrowUp, ArrowDown, ClipboardCheck, Star, UserCheck as CoachingIcon, History } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import type { FormationFormula } from "@/types/training";
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
import EvaluationDetailDialog, { type EvaluationData } from "./EvaluationDetailDialog";
import ParticipantTraceabilityDrawer from "./ParticipantTraceabilityDrawer";
import {
  type EvaluationInfo,
  type CertificateInfo as CertInfo,
  computeEvaluationStats,
  buildEvaluationMaps,
} from "@/lib/evaluationUtils";

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
  formula?: string | null;
  formula_id?: string | null;
  coaching_sessions_total?: number;
  coaching_sessions_completed?: number;
  coaching_deadline?: string | null;
}

interface ParticipantListProps {
  participants: Participant[];
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  formatFormation: string | null;
  isInterEntreprise?: boolean;
  elearningDuration?: number | null;
  availableFormulas?: FormationFormula[];
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
  isInterEntreprise: isInterEntrepriseProp,
  elearningDuration,
  availableFormulas = [],
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
  const [certificatesByParticipant, setCertificatesByParticipant] = useState<Map<string, CertInfo>>(new Map());
  const [conventionSignatures, setConventionSignatures] = useState<Map<string, ConventionSignatureInfo>>(new Map());
  const [sendingCertId, setSendingCertId] = useState<string | null>(null);
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const [downloadingConventionId, setDownloadingConventionId] = useState<string | null>(null);
  const [conventionRemindingId, setConventionRemindingId] = useState<string | null>(null);
  const [participantsWithSignatures, setParticipantsWithSignatures] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"last_name" | "first_name" | "email" | "amount" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [evaluationsByParticipant, setEvaluationsByParticipant] = useState<Map<string, EvaluationInfo>>(new Map());
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationData | null>(null);
  const [showEvaluationDetail, setShowEvaluationDetail] = useState(false);
  const [traceabilityParticipant, setTraceabilityParticipant] = useState<Participant | null>(null);
  const { toast } = useToast();

  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const isIndividualConvention = isInterEntreprise;
  const hasCoachingParticipants = participants.some((p) => (p.coaching_sessions_total || 0) > 0);

  // Fetch all evaluations (certificates + status) for all participants
  useEffect(() => {
    const fetchEvaluations = async () => {
      const { data, error } = await supabase
        .from("training_evaluations")
        .select(`
          id, participant_id, certificate_url, etat, date_soumission,
          first_name, last_name, company, email,
          appreciation_generale, recommandation, message_recommandation,
          objectifs_evaluation, objectif_prioritaire, delai_application,
          freins_application, rythme, equilibre_theorie_pratique,
          amelioration_suggeree, conditions_info_satisfaisantes,
          formation_adaptee_public, qualification_intervenant_adequate,
          appreciations_prises_en_compte, consent_publication, remarques_libres
        `)
        .eq("training_id", trainingId);

      if (!error && data) {
        const { certificateMap, evaluationMap } = buildEvaluationMaps(data);
        setCertificatesByParticipant(certificateMap);
        setEvaluationsByParticipant(evaluationMap);
      }
    };
    fetchEvaluations();
  }, [trainingId, participants]);

  // Fetch attendance signatures to block deletion for participants who signed
  useEffect(() => {
    const fetchAttendanceSignatures = async () => {
      const { data, error } = await supabase
        .from("attendance_signatures")
        .select("participant_id")
        .eq("training_id", trainingId)
        .not("signed_at", "is", null);

      if (!error && data) {
        const ids = new Set<string>(data.map((r) => r.participant_id));
        setParticipantsWithSignatures(ids);
      }
    };
    fetchAttendanceSignatures();
  }, [trainingId, participants]);

  // Fetch convention signature statuses for inter/e-learning participants
  useEffect(() => {
    if (!isIndividualConvention) return;
    
    const fetchConventionSignatures = async () => {
      const sponsorEmails = participants
        .filter(p => p.sponsor_email)
        .map(p => p.sponsor_email!);
      
      if (sponsorEmails.length === 0) return;

      const { data, error } = await supabase
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

  // Check if we're at J-2 or later
  const daysUntilTraining = trainingStartDate ? differenceInDays(parseISO(trainingStartDate), new Date()) : null;
  const canSendManually = daysUntilTraining === null || daysUntilTraining <= 2;

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

      // Refresh participant data so convention URL is reflected in UI
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

  // Copy email to clipboard
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast({ title: "Email copié", description: email });
  };

  // Toggle a coaching session completed/uncompleted
  const handleToggleCoachingSession = async (participant: Participant) => {
    const current = participant.coaching_sessions_completed || 0;
    const total = participant.coaching_sessions_total || 0;
    const newCompleted = current < total ? current + 1 : current - 1;
    const { error } = await supabase
      .from("training_participants")
      .update({ coaching_sessions_completed: Math.max(0, newCompleted) })
      .eq("id", participant.id);
    if (!error) onParticipantUpdated();
  };

  const handleUncheckCoachingSession = async (participant: Participant) => {
    const current = participant.coaching_sessions_completed || 0;
    if (current <= 0) return;
    const { error } = await supabase
      .from("training_participants")
      .update({ coaching_sessions_completed: current - 1 })
      .eq("id", participant.id);
    if (!error) onParticipantUpdated();
  };

  // Helper to render action buttons for a participant in chronological training order
  const renderParticipantActions = (participant: Participant, displayName: string) => (
    <div className="flex items-center gap-0.5">
      {/* 1. Convention - inter/e-learning */}
      {isIndividualConvention && (() => {
        const hasConvention = !!participant.convention_file_url;
        const sigInfo = conventionSignatures.get(participant.id);
        const isLoading = generatingConventionId === participant.id || downloadingConventionId === participant.id;

        if (!hasConvention) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleGenerateConvention(participant)} disabled={isLoading}>
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
              <DropdownMenuItem onClick={() => handleDownloadConvention(participant)}>
                <Download className="h-4 w-4 mr-2" />Télécharger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGenerateConvention(participant)}>
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
                <DropdownMenuItem onClick={() => handleSendConventionReminder(participant)} disabled={conventionRemindingId === participant.id}>
                  {conventionRemindingId === participant.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
                  Relancer convention
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })()}

      {/* 2. Questionnaire des besoins */}
      {(participant.needs_survey_status === "complete" || participant.needs_survey_status === "valide_formateur") && (
        <ViewQuestionnaireDialog participantId={participant.id} participantName={displayName} trainingId={trainingId} />
      )}
      {canSendSurveyFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleSendSurvey(participant)} disabled={sendingId === participant.id}>
              {sendingId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Envoyer le questionnaire</p></TooltipContent>
        </Tooltip>
      )}
      {canSendReminderFor(participant) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleSendReminder(participant)} disabled={remindingId === participant.id}>
              {remindingId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Relancer recueil des besoins</p></TooltipContent>
        </Tooltip>
      )}

      {/* 3. Évaluation */}
      {(() => {
        const evalInfo = evaluationsByParticipant.get(participant.id);
        if (!evalInfo) return null;
        if (evalInfo.etat === "soumis") {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => { if (evalInfo.fullData) { setSelectedEvaluation(evalInfo.fullData); setShowEvaluationDetail(true); } }}>
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
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" disabled={generatingCertId === participant.id} onClick={() => handleGenerateCertificate(participant)}>
                  {generatingCertId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Générer l'attestation</p></TooltipContent>
            </Tooltip>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" disabled={sendingCertId === participant.id}>
                {sendingCertId === participant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(cert!.certificateUrl!, "_blank")}>
                <Download className="h-4 w-4 mr-2" />Télécharger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSendCertificate(participant, participant.email, participant.first_name || "")}>
                <Forward className="h-4 w-4 mr-2" />Envoyer au participant
              </DropdownMenuItem>
              {sponsorEmail && (
                <DropdownMenuItem onClick={() => handleSendCertificate(participant, sponsorEmail, sponsorName)}>
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
              className={`h-7 w-7 ${participant.invoice_file_url ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              onClick={() => setDocumentsParticipant(participant)}
            >
              <Receipt className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{participant.invoice_file_url ? "Facture uploadée" : "Gérer la facture"}</p></TooltipContent>
        </Tooltip>
      )}

      {/* 6. Traçabilité Qualiopi */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setTraceabilityParticipant(participant)}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Traçabilité participant</p></TooltipContent>
      </Tooltip>

      {/* 7. Edit */}
      <EditParticipantDialog
        participant={participant}
        trainingId={trainingId}
        formatFormation={formatFormation}
        isInterEntreprise={isInterEntreprise}
        trainingElearningDuration={elearningDuration}
        availableFormulas={availableFormulas}
        onParticipantUpdated={onParticipantUpdated}
      />

      {/* 7. Delete */}
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
              <AlertDialogAction onClick={() => handleDelete(participant)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  // Evaluation summary stats (delegated to pure function)
  const { total: evalTotal, soumis: evalSoumis, envoye: evalEnvoye, avgRating } =
    computeEvaluationStats(evaluationsByParticipant, participants.length);

  return (
    <>
      {/* Evaluation summary bar */}
      {evalTotal > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-muted/50 rounded-lg text-sm">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Évaluations :</span>
          <Badge variant={evalSoumis === participants.length ? "default" : "secondary"} className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {evalSoumis} soumise{evalSoumis !== 1 ? "s" : ""}
          </Badge>
          {evalEnvoye > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {evalEnvoye} en attente
            </Badge>
          )}
          {participants.length - evalTotal > 0 && (
            <span className="text-muted-foreground">
              {participants.length - evalTotal} non envoyée{participants.length - evalTotal !== 1 ? "s" : ""}
            </span>
          )}
          {avgRating > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{avgRating.toFixed(1)}/5</span>
            </span>
          )}
        </div>
      )}

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
                    {participant.formula && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 w-fit">
                        {participant.formula}
                      </Badge>
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
                  Participant <SortIcon field="last_name" />
                </button>
              </TableHead>
              {isInterEntreprise && (
                <TableHead>
                  <button onClick={() => toggleSort("amount")} className="flex items-center hover:text-foreground transition-colors">
                    Montant HT <SortIcon field="amount" />
                  </button>
                </TableHead>
              )}
              <TableHead>Recueil</TableHead>
              {hasCoachingParticipants && <TableHead>Coaching</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParticipants.map((participant) => {
              const statusConfig = getStatusConfig(participant.needs_survey_status);
              const StatusIcon = statusConfig.icon;
              const displayName = participant.first_name || participant.last_name
                ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                : participant.email;

              return (
                <TableRow key={participant.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {participant.first_name || participant.last_name
                              ? `${participant.last_name || ""} ${participant.first_name || ""}`.trim()
                              : "—"}
                          </span>
                          {participant.company && (
                            <span className="text-xs text-muted-foreground">· {participant.company}</span>
                          )}
                          {participant.formula && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {participant.formula}
                            </Badge>
                          )}
                          {isInterEntreprise && participant.payment_mode === "invoice" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block w-2 h-2 rounded-full bg-warning" />
                              </TooltipTrigger>
                              <TooltipContent><p>À facturer</p></TooltipContent>
                            </Tooltip>
                          )}
                          {participant.notes && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent><p className="max-w-xs whitespace-pre-wrap">{participant.notes}</p></TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                            onClick={() => handleCopyEmail(participant.email)}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Copier {participant.email}</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  {isInterEntreprise && (
                    <TableCell className="tabular-nums">
                      {participant.sold_price_ht != null
                        ? `${participant.sold_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={statusConfig.variant} className="cursor-help gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>{statusConfig.tooltip}</p></TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {hasCoachingParticipants && (
                    <TableCell>
                      {(participant.coaching_sessions_total || 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: participant.coaching_sessions_total || 0 }).map((_, i) => {
                            const isCompleted = i < (participant.coaching_sessions_completed || 0);
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                      isCompleted
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/30 hover:border-primary"
                                    }`}
                                    onClick={() => {
                                      if (isCompleted && i === (participant.coaching_sessions_completed || 0) - 1) {
                                        handleUncheckCoachingSession(participant);
                                      } else if (!isCompleted && i === (participant.coaching_sessions_completed || 0)) {
                                        handleToggleCoachingSession(participant);
                                      }
                                    }}
                                  >
                                    {isCompleted && <CheckCircle className="h-3 w-3" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Séance {i + 1}/{participant.coaching_sessions_total} {isCompleted ? "(réalisée)" : "(à programmer)"}</p>
                                  {participant.coaching_deadline && (
                                    <p className="text-xs">Validité : {new Date(participant.coaching_deadline).toLocaleDateString("fr-FR")}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end">
                      {renderParticipantActions(participant, displayName)}
                    </div>
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

      {/* Evaluation detail dialog */}
      <EvaluationDetailDialog
        open={showEvaluationDetail}
        onOpenChange={setShowEvaluationDetail}
        evaluation={selectedEvaluation}
        trainingName={trainingName}
      />

      {/* Traceability drawer */}
      {traceabilityParticipant && (
        <ParticipantTraceabilityDrawer
          open={!!traceabilityParticipant}
          onOpenChange={(open) => !open && setTraceabilityParticipant(null)}
          participantId={traceabilityParticipant.id}
          participantEmail={traceabilityParticipant.email}
          participantName={
            traceabilityParticipant.first_name || traceabilityParticipant.last_name
              ? `${traceabilityParticipant.first_name || ""} ${traceabilityParticipant.last_name || ""}`.trim()
              : traceabilityParticipant.email
          }
          trainingId={trainingId}
          trainingName={trainingName}
        />
      )}
    </>
  );
};

export default ParticipantList;
