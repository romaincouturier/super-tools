import { useRef, useState } from "react";
import { Send, FileText, Receipt, ClipboardList, Mail, Award, Star } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { exportAttendancePdf } from "../attendance/attendancePdfExport";
import { supabase } from "@/integrations/supabase/client";

import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DocumentSentInfo, DocumentType } from "./types";
import SendRecipientDialog from "./SendRecipientDialog";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";
import { missingTrainerSlots, readCertificateGeneration } from "@/lib/trainingDocumentDelivery";

interface DocumentDeliverySectionProps {
  trainingId: string;
  trainingName: string;
  startDate: string | null;
  endDate: string | null;
  isInterEntreprise: boolean;
  invoiceFileUrl: string | null;
  attendanceSheetsUrls: string[];
  certificateUrls: string[];
  sponsorEmail: string | null;
  sponsorName: string | null;
  sponsorFirstName: string | null;
  sponsorFormalAddress: boolean;
  documentsSentInfo: DocumentSentInfo;
  setDocumentsSentInfo: React.Dispatch<React.SetStateAction<DocumentSentInfo>>;
  evaluationCount?: number;
  signatureCount?: number;
  participants?: { id: string; first_name: string | null; last_name: string | null; email: string }[];
  clientName?: string;
  trainingDuree?: string;
  onCertificatesGenerated?: () => void;
}

const DocumentDeliverySection = ({
  trainingId,
  trainingName,
  startDate,
  endDate,
  isInterEntreprise,
  invoiceFileUrl,
  attendanceSheetsUrls,
  certificateUrls,
  sponsorEmail,
  sponsorName,
  sponsorFirstName,
  sponsorFormalAddress,
  setDocumentsSentInfo,
  evaluationCount = 0,
  signatureCount = 0,
  participants = [],
  clientName = "",
  trainingDuree = "",
  onCertificatesGenerated,
}: DocumentDeliverySectionProps) => {
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentType | null>(null);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { loading: sendingDocuments, invoke: invokeSendDocs } = useEdgeFunction(
    "send-training-documents",
    { errorMessage: "Impossible d'envoyer les documents." },
  );

  const [generatingCerts, setGeneratingCerts] = useState(false);
  const [preparingDocuments, setPreparingDocuments] = useState(false);
  const deliveryLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const busy = sendingDocuments || preparingDocuments || generatingCerts;
  const hasCertificates = certificateUrls.length > 0;
  const hasEvaluations = evaluationCount > 0;
  const hasSheets = attendanceSheetsUrls.length > 0 || signatureCount > 0;
  const canGenerateCerts = participants.length > 0 && !!clientName && !!trainingDuree && !!startDate;
  const hasDocuments = invoiceFileUrl || hasSheets || hasCertificates || hasEvaluations || canGenerateCerts;
  const docCount = (invoiceFileUrl ? 1 : 0) + (hasSheets ? 1 : 0) + (hasCertificates || canGenerateCerts ? 1 : 0) + (hasEvaluations ? 1 : 0);

  const generateCertificates = async (recipientEmail: string, generateOnly = false): Promise<string[]> => {
    if (!canGenerateCerts) throw new Error("Les informations nécessaires aux attestations sont manquantes.");
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error("Session expirée. Reconnectez-vous avant l'envoi.");
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
            entreprise: clientName,
            duree: trainingDuree,
            dateDebut: startDate,
            dateFin: endDate || startDate,
            emailDestinataire: session.data.session?.user?.email || "",
            emailCommanditaire: recipientEmail,
            participants: participants.map(p => ({
              prenom: p.first_name || "",
              nom: p.last_name || "",
              email: p.email,
              participantId: p.id,
            })),
            userId: session.data.session?.user?.id,
            trainingId,
            generateOnly,
          }),
        },
      );
      return readCertificateGeneration(response, participants.length);
  };

  const handleGenerateAndSendCertificates = async (recipientEmail: string) => {
    if (deliveryLock.current) return;
    deliveryLock.current = true;
    setGeneratingCerts(true);
    try {
      await generateCertificates(recipientEmail);
      toast({
        title: "Attestations envoyées",
        description: `Les attestations ont été générées et envoyées à ${isDemoMode ? maskEmail(recipientEmail) : recipientEmail}.`,
      });
      onCertificatesGenerated?.();
    } catch (error: unknown) {
      console.error("Error generating certificates:", error);
      toastError(toast, error instanceof Error ? error.message : "Erreur lors de la génération des attestations.");
    } finally {
      setGeneratingCerts(false);
      deliveryLock.current = false;
    }
  };


  const ensureAttendanceSheetsUrls = async (): Promise<string[]> => {
    const { data, error } = await supabase.functions.invoke("generate-attendance-pdf", { body: { trainingId } });
    if (error) throw error;
    if (!data?.success) throw new Error("Impossible de vérifier les signatures d'émargement.");
    const missing = missingTrainerSlots(data.signatures || [], data.trainerSignatures || []);
    if (missing.length > 0) {
      throw new Error(`Signez d'abord les ${missing.length} demi-journée(s) dans la rubrique Émargement en tant que formateur. Aucun document n'a été envoyé.`);
    }
    if (attendanceSheetsUrls.length > 0) return attendanceSheetsUrls;
    if (!data.signatures?.length) return [];
    const exported = await exportAttendancePdf({ trainingId, trainingName, startDate, download: false });
    if (!exported.success) throw new Error(exported.message);
    const { data: training, error: trainingError } = await supabase.from("trainings").select("attendance_sheets_urls").eq("id", trainingId).single();
    if (trainingError) throw trainingError;
    const urls = (training?.attendance_sheets_urls as string[]) || [];
    if (urls.length === 0) throw new Error("La feuille d'émargement n'a pas été enregistrée. Aucun document n'a été envoyé.");
    return urls;
  };

  const handleSendDocuments = async (type: DocumentType, recipientEmail?: string, cc?: string) => {
    if (deliveryLock.current) return;
    const targetEmail = recipientEmail || sponsorEmail;
    if (!targetEmail) {
      toast({ title: "Email manquant", description: "Aucun email de destinataire n'est défini.", variant: "destructive" });
      return;
    }
    if (type === "invoice" && !invoiceFileUrl) {
      toast({ title: "Pas de facture", description: "Aucune facture n'a été uploadée.", variant: "destructive" });
      return;
    }

    deliveryLock.current = true;
    setPreparingDocuments(true);
    try {
    let sheetsToSend = attendanceSheetsUrls;
    if (type === "sheets" || type === "all") {
      sheetsToSend = await ensureAttendanceSheetsUrls();
      if ((type === "sheets" || hasSheets) && sheetsToSend.length === 0) {
        toast({ title: "Pas de feuilles", description: "Aucune feuille d'émargement n'est disponible.", variant: "destructive" });
        return;
      }
    }

    let certificatesToSend = certificateUrls;
    if (type === "all" && participants.length > 0) {
      certificatesToSend = await generateCertificates(targetEmail, true);
      if (certificatesToSend.length !== participants.length) throw new Error("Les attestations ne sont pas toutes disponibles. Aucun document n'a été envoyé.");
      onCertificatesGenerated?.();
    }

    const result = await invokeSendDocs({
      trainingId, trainingName, startDate, endDate,
      recipientEmail: targetEmail,
      recipientName: recipientEmail ? null : sponsorName,
      recipientFirstName: recipientEmail ? null : sponsorFirstName,
      documentType: type,
      invoiceUrl: type === "sheets" || type === "certificates" || type === "evaluations" ? null : invoiceFileUrl,
      attendanceSheetsUrls: type === "invoice" || type === "certificates" || type === "evaluations" ? [] : sheetsToSend,
      certificateUrls: type === "certificates" || type === "all" ? certificatesToSend : [],
      requestId: requestId.current,
      includeEvaluations: type === "all" && hasEvaluations,
      ccEmail: cc || null,
      formalAddress: sponsorFormalAddress,
    });

    if (result !== null) {
      let description = `Les documents ont été envoyés à ${targetEmail}`;
      if (cc) description += ` (CC: ${cc})`;
      toast({ title: "Documents envoyés", description: description + "." });

      const now = new Date().toISOString();
      if ((type === "invoice" || type === "all") && invoiceFileUrl) setDocumentsSentInfo(prev => ({ ...prev, invoice: now }));
      if ((type === "sheets" || type === "all") && sheetsToSend.length > 0) setDocumentsSentInfo(prev => ({ ...prev, sheets: now }));

      resetDialog();
    }
    } catch (error) {
      toast({ title: "Envoi interrompu", description: error instanceof Error ? error.message : "Impossible de préparer les documents.", variant: "destructive" });
    } finally {
      deliveryLock.current = false;
      setPreparingDocuments(false);
    }
  };

  const resetDialog = () => {
    setShowCustomRecipientDialog(false);
    setCustomRecipientEmail("");
    setCcEmail("");
    setPendingDocumentType(null);
    setSendToSponsorWithOptions(false);
  };

  const openCustomRecipientDialog = (type: DocumentType, toSponsor: boolean = false) => {
    if (deliveryLock.current) return;
    requestId.current = crypto.randomUUID();
    setPendingDocumentType(type);
    setSendToSponsorWithOptions(toSponsor);
    if (toSponsor && sponsorEmail) {
      setCustomRecipientEmail(sponsorEmail);
      setCcEmail("");
    } else {
      setCustomRecipientEmail("");
      setCcEmail(sponsorEmail || "");
    }
    setShowCustomRecipientDialog(true);
  };

  const renderSendButton = () => (
    <Button type="button" variant="default" className="w-full" disabled={busy}>
      {busy ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
      Envoyer les documents
    </Button>
  );

  const renderInterEntrepriseMenu = () => (
    <DropdownMenuContent align="end" className="w-72">
      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Envoyer à un destinataire</p>
      {hasSheets && (
        <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}>
          <ClipboardList className="h-4 w-4 mr-2" />Feuille d&apos;émargement
        </DropdownMenuItem>
      )}
      {hasCertificates && (
        <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", false)}>
          <Award className="h-4 w-4 mr-2" />Certificats ({certificateUrls.length})
        </DropdownMenuItem>
      )}
      {hasEvaluations && (
        <DropdownMenuItem onClick={() => openCustomRecipientDialog("evaluations", false)}>
          <Star className="h-4 w-4 mr-2" />Évaluations participants ({evaluationCount})
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );

  const renderStandardMenu = () => (
    <DropdownMenuContent align="end" className="w-72">
      {sponsorEmail && (
        <>
          <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Envoyer au commanditaire</p>
          <p className="px-2 pb-1.5 text-xs text-muted-foreground truncate">{sponsorEmail}</p>
          {invoiceFileUrl && <DropdownMenuItem onClick={() => openCustomRecipientDialog("invoice", true)}><Receipt className="h-4 w-4 mr-2" />Facture</DropdownMenuItem>}
          {hasSheets && <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", true)}><ClipboardList className="h-4 w-4 mr-2" />Feuille d&apos;émargement</DropdownMenuItem>}
          {canGenerateCerts && sponsorEmail && (
            <DropdownMenuItem disabled={generatingCerts} onClick={() => handleGenerateAndSendCertificates(sponsorEmail)}>
              <Award className="h-4 w-4 mr-2" />
              {generatingCerts ? "Génération & envoi…" : `Attestations de réalisation (${participants.length})`}
            </DropdownMenuItem>
          )}
          {hasEvaluations && <DropdownMenuItem onClick={() => openCustomRecipientDialog("evaluations", true)}><Star className="h-4 w-4 mr-2" />Évaluations participants ({evaluationCount})</DropdownMenuItem>}
          {docCount >= 2 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", true)}><FileText className="h-4 w-4 mr-2" />Tous les documents</DropdownMenuItem>}
          <DropdownMenuSeparator />
        </>
      )}
      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Envoyer à un autre destinataire</p>
      {invoiceFileUrl && <DropdownMenuItem onClick={() => openCustomRecipientDialog("invoice", false)}><Mail className="h-4 w-4 mr-2" />Facture → autre email</DropdownMenuItem>}
      {hasSheets && <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}><Mail className="h-4 w-4 mr-2" />Émargement → autre email</DropdownMenuItem>}
      {hasCertificates && <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", false)}><Mail className="h-4 w-4 mr-2" />Certificats → autre email</DropdownMenuItem>}
      {hasEvaluations && <DropdownMenuItem onClick={() => openCustomRecipientDialog("evaluations", false)}><Mail className="h-4 w-4 mr-2" />Évaluations → autre email</DropdownMenuItem>}
      {docCount >= 2 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", false)}><Mail className="h-4 w-4 mr-2" />Tous → autre email</DropdownMenuItem>}
    </DropdownMenuContent>
  );

  return (
    <>
      <div className="pt-4 border-t space-y-3">
        {isInterEntreprise ? (
          (hasSheets || hasCertificates || hasEvaluations) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>{renderSendButton()}</DropdownMenuTrigger>
              {renderInterEntrepriseMenu()}
            </DropdownMenu>
          ) : (
            <Button type="button" variant="default" className="w-full" disabled>
              <Send className="h-4 w-4 mr-2" />Envoyer les documents
            </Button>
          )
        ) : hasDocuments ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{renderSendButton()}</DropdownMenuTrigger>
            {renderStandardMenu()}
          </DropdownMenu>
        ) : (
          <Button type="button" variant="default" className="w-full" disabled>
            <Send className="h-4 w-4 mr-2" />Envoyer les documents
          </Button>
        )}
        {!isInterEntreprise && !invoiceFileUrl && !hasSheets && (
          <p className="text-xs text-muted-foreground text-center">
            Uploadez une facture ou des feuilles d&apos;émargement pour les envoyer
          </p>
        )}
        {isInterEntreprise && !hasSheets && !hasCertificates && !hasEvaluations && (
          <p className="text-xs text-muted-foreground text-center">
            Uploadez des feuilles d&apos;émargement pour les envoyer. Les factures sont gérées par participant.
          </p>
        )}
      </div>

      <SendRecipientDialog
        open={showCustomRecipientDialog}
        onOpenChange={setShowCustomRecipientDialog}
        sendToSponsorWithOptions={sendToSponsorWithOptions}
        pendingDocumentType={pendingDocumentType}
        customRecipientEmail={customRecipientEmail}
        setCustomRecipientEmail={setCustomRecipientEmail}
        ccEmail={ccEmail}
        setCcEmail={setCcEmail}
        sendingDocuments={busy}
        onSend={() => {
          if (pendingDocumentType && customRecipientEmail) {
            const emailToPass = sendToSponsorWithOptions ? undefined : customRecipientEmail;
            handleSendDocuments(pendingDocumentType, emailToPass, ccEmail || undefined);
          }
        }}
        onCancel={resetDialog}
      />
    </>
  );
};

export default DocumentDeliverySection;
