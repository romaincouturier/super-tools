import { useState } from "react";
import { Send, Loader2, FileText, Receipt, ClipboardList, Mail, Award, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DocumentSentInfo, DocumentType } from "./types";
import SendRecipientDialog from "./SendRecipientDialog";

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
}: DocumentDeliverySectionProps) => {
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentType | null>(null);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const { toast } = useToast();

  const hasCertificates = certificateUrls.length > 0;
  const hasEvaluations = evaluationCount > 0;
  const hasDocuments = invoiceFileUrl || attendanceSheetsUrls.length > 0 || hasCertificates || hasEvaluations;
  const docCount = (invoiceFileUrl ? 1 : 0) + (attendanceSheetsUrls.length > 0 ? 1 : 0) + (hasCertificates ? 1 : 0) + (hasEvaluations ? 1 : 0);

  const handleSendDocuments = async (type: DocumentType, recipientEmail?: string, cc?: string) => {
    const targetEmail = recipientEmail || sponsorEmail;
    if (!targetEmail) {
      toast({ title: "Email manquant", description: "Aucun email de destinataire n'est défini.", variant: "destructive" });
      return;
    }
    if (type === "invoice" && !invoiceFileUrl) {
      toast({ title: "Pas de facture", description: "Aucune facture n'a été uploadée.", variant: "destructive" });
      return;
    }
    if (type === "sheets" && attendanceSheetsUrls.length === 0) {
      toast({ title: "Pas de feuilles", description: "Aucune feuille d'émargement n'a été uploadée.", variant: "destructive" });
      return;
    }

    setSendingDocuments(true);
    try {
      const { error } = await supabase.functions.invoke("send-training-documents", {
        body: {
          trainingId, trainingName, startDate, endDate,
          recipientEmail: targetEmail,
          recipientName: recipientEmail ? null : sponsorName,
          recipientFirstName: recipientEmail ? null : sponsorFirstName,
          documentType: type,
          invoiceUrl: type === "sheets" || type === "certificates" ? null : invoiceFileUrl,
          attendanceSheetsUrls: type === "invoice" || type === "certificates" ? [] : attendanceSheetsUrls,
          certificateUrls: type === "certificates" || type === "all" ? certificateUrls : [],
          ccEmail: cc || null,
          formalAddress: sponsorFormalAddress,
        },
      });
      if (error) throw error;

      let description = `Les documents ont été envoyés à ${targetEmail}`;
      if (cc) description += ` (CC: ${cc})`;
      toast({ title: "Documents envoyés", description: description + "." });

      const now = new Date().toISOString();
      if (type === "invoice" || type === "all") setDocumentsSentInfo(prev => ({ ...prev, invoice: now }));
      if (type === "sheets" || type === "all") setDocumentsSentInfo(prev => ({ ...prev, sheets: now }));

      resetDialog();
    } catch (error: unknown) {
      console.error("Send error:", error);
      toast({ title: "Erreur d'envoi", description: error instanceof Error ? error.message : "Impossible d'envoyer les documents.", variant: "destructive" });
    } finally {
      setSendingDocuments(false);
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
    <Button type="button" variant="default" className="w-full" disabled={sendingDocuments}>
      {sendingDocuments ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
      Envoyer les documents
    </Button>
  );

  const renderInterEntrepriseMenu = () => (
    <DropdownMenuContent align="end" className="w-72">
      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Envoyer à un destinataire</p>
      {attendanceSheetsUrls.length > 0 && (
        <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}>
          <ClipboardList className="h-4 w-4 mr-2" />Feuilles d&apos;émargement
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
          {attendanceSheetsUrls.length > 0 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", true)}><ClipboardList className="h-4 w-4 mr-2" />Feuilles d&apos;émargement</DropdownMenuItem>}
          {hasCertificates && <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", true)}><Award className="h-4 w-4 mr-2" />Certificats ({certificateUrls.length})</DropdownMenuItem>}
          {hasEvaluations && <DropdownMenuItem onClick={() => openCustomRecipientDialog("evaluations", true)}><Star className="h-4 w-4 mr-2" />Évaluations participants ({evaluationCount})</DropdownMenuItem>}
          {docCount >= 2 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", true)}><FileText className="h-4 w-4 mr-2" />Tous les documents</DropdownMenuItem>}
          <DropdownMenuSeparator />
        </>
      )}
      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Envoyer à un autre destinataire</p>
      {invoiceFileUrl && <DropdownMenuItem onClick={() => openCustomRecipientDialog("invoice", false)}><Mail className="h-4 w-4 mr-2" />Facture → autre email</DropdownMenuItem>}
      {attendanceSheetsUrls.length > 0 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}><Mail className="h-4 w-4 mr-2" />Émargements → autre email</DropdownMenuItem>}
      {hasCertificates && <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", false)}><Mail className="h-4 w-4 mr-2" />Certificats → autre email</DropdownMenuItem>}
      {hasEvaluations && <DropdownMenuItem onClick={() => openCustomRecipientDialog("evaluations", false)}><Mail className="h-4 w-4 mr-2" />Évaluations → autre email</DropdownMenuItem>}
      {docCount >= 2 && <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", false)}><Mail className="h-4 w-4 mr-2" />Tous → autre email</DropdownMenuItem>}
    </DropdownMenuContent>
  );

  return (
    <>
      <div className="pt-4 border-t space-y-3">
        {isInterEntreprise ? (
          (attendanceSheetsUrls.length > 0 || hasCertificates) ? (
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
        {!isInterEntreprise && !invoiceFileUrl && attendanceSheetsUrls.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Uploadez une facture ou des feuilles d&apos;émargement pour les envoyer
          </p>
        )}
        {isInterEntreprise && attendanceSheetsUrls.length === 0 && (
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
        sendingDocuments={sendingDocuments}
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
