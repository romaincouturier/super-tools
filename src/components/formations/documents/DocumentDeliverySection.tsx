import { useState } from "react";
import { Send, Loader2, FileText, Receipt, ClipboardList, Mail, Award } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { DocumentSentInfo } from "./types";

type DocumentType = "invoice" | "sheets" | "certificates" | "all";

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
  documentsSentInfo,
  setDocumentsSentInfo,
}: DocumentDeliverySectionProps) => {
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentType | null>(null);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const { toast } = useToast();

  const hasCertificates = certificateUrls.length > 0;

  const handleSendDocuments = async (type: DocumentType, recipientEmail?: string, cc?: string) => {
    const targetEmail = recipientEmail || sponsorEmail;

    if (!targetEmail) {
      toast({
        title: "Email manquant",
        description: "Aucun email de destinataire n'est défini.",
        variant: "destructive",
      });
      return;
    }

    const hasInvoice = invoiceFileUrl;
    const hasSheets = attendanceSheetsUrls.length > 0;

    if (type === "invoice" && !hasInvoice) {
      toast({
        title: "Pas de facture",
        description: "Aucune facture n'a été uploadée.",
        variant: "destructive",
      });
      return;
    }

    if (type === "sheets" && !hasSheets) {
      toast({
        title: "Pas de feuilles",
        description: "Aucune feuille d'émargement n'a été uploadée.",
        variant: "destructive",
      });
      return;
    }

    setSendingDocuments(true);

    try {
      const { error } = await supabase.functions.invoke("send-training-documents", {
        body: {
          trainingId,
          trainingName,
          startDate,
          endDate,
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
      if (cc) {
        description += ` (CC: ${cc})`;
      }
      description += ".";

      toast({
        title: "Documents envoyés",
        description,
      });

      const now = new Date().toISOString();
      if (type === "invoice" || type === "all") {
        setDocumentsSentInfo(prev => ({ ...prev, invoice: now }));
      }
      if (type === "sheets" || type === "all") {
        setDocumentsSentInfo(prev => ({ ...prev, sheets: now }));
      }

      setShowCustomRecipientDialog(false);
      setCustomRecipientEmail("");
      setCcEmail("");
      setPendingDocumentType(null);
      setSendToSponsorWithOptions(false);
    } catch (error: unknown) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer les documents.",
        variant: "destructive",
      });
    } finally {
      setSendingDocuments(false);
    }
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

  return (
    <>
      <div className="pt-4 border-t space-y-3">
        {isInterEntreprise ? (
          (attendanceSheetsUrls.length > 0 || hasCertificates) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  disabled={sendingDocuments}
                >
                  {sendingDocuments ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer les documents
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                  Envoyer à un destinataire
                </p>
                {attendanceSheetsUrls.length > 0 && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Feuilles d&apos;émargement
                  </DropdownMenuItem>
                )}
                {hasCertificates && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", false)}>
                    <Award className="h-4 w-4 mr-2" />
                    Certificats ({certificateUrls.length})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              variant="default"
              className="w-full"
              disabled
            >
              <Send className="h-4 w-4 mr-2" />
              Envoyer les documents
            </Button>
          )
        ) : (
          (invoiceFileUrl || attendanceSheetsUrls.length > 0 || hasCertificates) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  disabled={sendingDocuments}
                >
                  {sendingDocuments ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer les documents
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {sponsorEmail && (
                  <>
                    <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      Envoyer au commanditaire
                    </p>
                    <p className="px-2 pb-1.5 text-xs text-muted-foreground truncate">
                      {sponsorEmail}
                    </p>
                    {invoiceFileUrl && (
                      <DropdownMenuItem onClick={() => openCustomRecipientDialog("invoice", true)}>
                        <Receipt className="h-4 w-4 mr-2" />
                        Facture
                      </DropdownMenuItem>
                    )}
                    {attendanceSheetsUrls.length > 0 && (
                      <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", true)}>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Feuilles d&apos;émargement
                      </DropdownMenuItem>
                    )}
                    {hasCertificates && (
                      <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", true)}>
                        <Award className="h-4 w-4 mr-2" />
                        Certificats ({certificateUrls.length})
                      </DropdownMenuItem>
                    )}
                    {(invoiceFileUrl ? 1 : 0) + (attendanceSheetsUrls.length > 0 ? 1 : 0) + (hasCertificates ? 1 : 0) >= 2 && (
                      <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", true)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Tous les documents
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                  Envoyer à un autre destinataire
                </p>
                {invoiceFileUrl && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("invoice", false)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Facture → autre email
                  </DropdownMenuItem>
                )}
                {attendanceSheetsUrls.length > 0 && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("sheets", false)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Émargements → autre email
                  </DropdownMenuItem>
                )}
                {hasCertificates && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("certificates", false)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Certificats → autre email
                  </DropdownMenuItem>
                )}
                {(invoiceFileUrl ? 1 : 0) + (attendanceSheetsUrls.length > 0 ? 1 : 0) + (hasCertificates ? 1 : 0) >= 2 && (
                  <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", false)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Tous → autre email
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              variant="default"
              className="w-full"
              disabled
            >
              <Send className="h-4 w-4 mr-2" />
              Envoyer les documents
            </Button>
          )
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

      {/* Custom Recipient Dialog */}
      <Dialog open={showCustomRecipientDialog} onOpenChange={setShowCustomRecipientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sendToSponsorWithOptions ? "Envoyer au commanditaire" : "Envoyer à un autre destinataire"}
            </DialogTitle>
            <DialogDescription>
              {sendToSponsorWithOptions
                ? `Envoi de ${pendingDocumentType === "invoice" ? "la facture" : pendingDocumentType === "sheets" ? "les feuilles d'émargement" : pendingDocumentType === "certificates" ? "les certificats" : "tous les documents"} au commanditaire. Vous pouvez ajouter un email en copie.`
                : `Entrez l'adresse email du destinataire pour ${pendingDocumentType === "invoice" ? "la facture" : pendingDocumentType === "sheets" ? "les feuilles d'émargement" : pendingDocumentType === "certificates" ? "les certificats" : "tous les documents"}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customEmail">Email du destinataire</Label>
              <Input
                id="customEmail"
                type="email"
                value={customRecipientEmail}
                onChange={(e) => setCustomRecipientEmail(e.target.value)}
                placeholder="destinataire@exemple.fr"
                disabled={sendToSponsorWithOptions}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmail">Email en copie (CC) - optionnel</Label>
              <Input
                id="ccEmail"
                type="email"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="copie@exemple.fr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomRecipientDialog(false);
                setCustomRecipientEmail("");
                setCcEmail("");
                setPendingDocumentType(null);
                setSendToSponsorWithOptions(false);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (pendingDocumentType && customRecipientEmail) {
                  const emailToPass = sendToSponsorWithOptions ? undefined : customRecipientEmail;
                  handleSendDocuments(pendingDocumentType, emailToPass, ccEmail || undefined);
                }
              }}
              disabled={!customRecipientEmail || sendingDocuments}
            >
              {sendingDocuments ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentDeliverySection;
