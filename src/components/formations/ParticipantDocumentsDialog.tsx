import { useState, useEffect } from "react";
import { FileText, Upload, Trash2, Loader2, Send, Receipt, Mail, User, ClipboardList, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  invoice_file_url: string | null;
}

interface ParticipantDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: Participant;
  trainingId: string;
  trainingName: string;
  startDate: string;
  endDate: string | null;
  attendanceSheetsUrls: string[];
  onUpdate: () => void;
}

const ParticipantDocumentsDialog = ({
  open,
  onOpenChange,
  participant,
  trainingId,
  trainingName,
  startDate,
  endDate,
  attendanceSheetsUrls,
  onUpdate,
}: ParticipantDocumentsDialogProps) => {
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(participant.invoice_file_url);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [ccEmail, setCcEmail] = useState("");
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setInvoiceFileUrl(participant.invoice_file_url);
  }, [participant.invoice_file_url]);

  // Fetch certificate for this participant
  useEffect(() => {
    const fetchCertificate = async () => {
      const { data } = await supabase
        .from("training_evaluations")
        .select("certificate_url")
        .eq("training_id", trainingId)
        .eq("participant_id", participant.id)
        .not("certificate_url", "is", null)
        .maybeSingle();

      setCertificateUrl(data?.certificate_url as string | null ?? null);
    };

    if (open) fetchCertificate();
  }, [trainingId, participant.id, open]);

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[()[\]{}]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
  };

  const participantName = participant.first_name || participant.last_name
    ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
    : participant.email;

  const sponsorName = participant.sponsor_first_name || participant.sponsor_last_name
    ? `${participant.sponsor_first_name || ""} ${participant.sponsor_last_name || ""}`.trim()
    : null;

  const hasInvoice = Boolean(invoiceFileUrl);
  const hasSheets = attendanceSheetsUrls.length > 0;
  const hasCertificate = Boolean(certificateUrl);
  const hasSponsorEmail = Boolean(participant.sponsor_email);
  const canSendDocuments = hasSponsorEmail && (hasInvoice || hasSheets || hasCertificate);

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    setUploadingInvoice(true);

    try {
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "");
      const sanitizedName = sanitizeFileName(baseName);
      const fileName = `${trainingId}/participant_${participant.id}/facture_${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);

      // Save to participant record
      const { error: updateError } = await supabase
        .from("training_participants")
        .update({ invoice_file_url: publicUrl })
        .eq("id", participant.id);

      if (updateError) throw updateError;

      setInvoiceFileUrl(publicUrl);
      onUpdate();

      toast({
        title: "Facture uploadée",
        description: "La facture a été ajoutée pour ce participant.",
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
      toast({
        title: "Erreur d'upload",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceFileUrl) return;

    try {
      const urlParts = invoiceFileUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("training-documents")
          .remove([urlParts[1]]);
      }

      const { error: updateError } = await supabase
        .from("training_participants")
        .update({ invoice_file_url: null })
        .eq("id", participant.id);

      if (updateError) throw updateError;

      setInvoiceFileUrl(null);
      onUpdate();

      toast({
        title: "Facture supprimée",
        description: "La facture a été retirée.",
      });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      const errorMessage = error instanceof Error ? error.message : "Impossible de supprimer la facture.";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSendDocuments = async (type: "invoice" | "sheets" | "certificates" | "all") => {
    const targetEmail = participant.sponsor_email;
    
    if (!targetEmail) {
      toast({
        title: "Email manquant",
        description: "Aucun email de commanditaire n'est défini pour ce participant.",
        variant: "destructive",
      });
      return;
    }

    if (type === "invoice" && !hasInvoice) {
      toast({
        title: "Pas de facture",
        description: "Aucune facture n'a été uploadée pour ce participant.",
        variant: "destructive",
      });
      return;
    }

    if (type === "sheets" && !hasSheets) {
      toast({
        title: "Pas de feuilles",
        description: "Aucune feuille d'émargement n'a été uploadée pour cette formation.",
        variant: "destructive",
      });
      return;
    }

    if (type === "all" && !hasInvoice && !hasSheets && !hasCertificate) {
      toast({
        title: "Pas de documents",
        description: "Aucun document n'est disponible.",
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
          recipientName: sponsorName,
          recipientFirstName: participant.sponsor_first_name,
          documentType: type,
          invoiceUrl: type === "sheets" || type === "certificates" ? null : invoiceFileUrl,
          attendanceSheetsUrls: type === "invoice" || type === "certificates" ? [] : attendanceSheetsUrls,
          certificateUrls: (type === "certificates" || type === "all") && certificateUrl ? [certificateUrl] : [],
          ccEmail: ccEmail || null,
          formalAddress: true, // default for inter-enterprise
        },
      });

      if (error) throw error;

      const docTypeLabel = type === "invoice" ? "La facture a été envoyée" 
        : type === "sheets" ? "Les feuilles d'émargement ont été envoyées"
        : "Les documents ont été envoyés";
      
      let description = `${docTypeLabel} à ${targetEmail}`;
      if (ccEmail) {
        description += ` (CC: ${ccEmail})`;
      }
      description += ".";

      toast({
        title: "Documents envoyés",
        description,
      });
      
      setCcEmail("");
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Send error:", error);
      const errorMessage = error instanceof Error ? error.message : "Impossible d'envoyer les documents.";
      toast({
        title: "Erreur d'envoi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSendingDocuments(false);
    }
  };

  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    // Remove timestamp prefix if present (format: facture_123456789_name.pdf)
    const match = fileName.match(/^(?:facture|emargement)_\d+_(.+)$/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return decodeURIComponent(fileName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Documents - {participantName}</DialogTitle>
          <DialogDescription>
            Gérez la facture et envoyez les documents au commanditaire
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sponsor info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Commanditaire (destinataire)
            </Label>
            {sponsorName ? (
              <p className="text-sm font-medium">{sponsorName}</p>
            ) : null}
            {participant.sponsor_email ? (
              <p className="text-sm text-primary">{participant.sponsor_email}</p>
            ) : (
              <p className="text-sm text-destructive italic">Aucun email de commanditaire défini</p>
            )}
          </div>

          {/* Invoice section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Facture
              </Label>
              <Label htmlFor={`invoice-${participant.id}`} className="cursor-pointer">
                <input
                  id={`invoice-${participant.id}`}
                  type="file"
                  accept=".pdf"
                  onChange={handleInvoiceUpload}
                  className="hidden"
                  disabled={uploadingInvoice}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingInvoice}
                  asChild
                >
                  <span>
                    {uploadingInvoice ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {invoiceFileUrl ? "Remplacer" : "Uploader"}
                  </span>
                </Button>
              </Label>
            </div>
            
            {invoiceFileUrl && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <a
                  href={invoiceFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-primary hover:underline truncate"
                >
                  {getFileNameFromUrl(invoiceFileUrl)}
                </a>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteInvoice}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Attendance Sheets info */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Feuilles d'émargement ({attendanceSheetsUrls.length})
            </Label>
            {hasSheets ? (
              <p className="text-xs text-muted-foreground">
                Les feuilles d'émargement sont partagées pour toute la formation.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Aucune feuille uploadée (utilisez la section Documents de la formation)
              </p>
            )}
          </div>

          {/* CC Email */}
          <div className="space-y-2">
            <Label htmlFor="ccEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email en copie (optionnel)
            </Label>
            <Input
              id="ccEmail"
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="copie@exemple.fr"
            />
          </div>
        </div>

        {/* Send buttons */}
        <div className="space-y-2">
          {canSendDocuments ? (
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
                  Envoyer au commanditaire
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {hasInvoice && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("invoice")}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Facture uniquement
                  </DropdownMenuItem>
                )}
                {hasSheets && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("sheets")}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Émargements uniquement
                  </DropdownMenuItem>
                )}
                {hasCertificate && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("certificates")}>
                    <Award className="h-4 w-4 mr-2" />
                    Certificat uniquement
                  </DropdownMenuItem>
                )}
                {((hasInvoice ? 1 : 0) + (hasSheets ? 1 : 0) + (hasCertificate ? 1 : 0)) >= 2 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSendDocuments("all")}>
                      <FileText className="h-4 w-4 mr-2" />
                      Tous les documents
                    </DropdownMenuItem>
                  </>
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
              Envoyer au commanditaire
            </Button>
          )}
          
          {!hasSponsorEmail && (
            <p className="text-xs text-destructive text-center">
              Définissez un email de commanditaire pour pouvoir envoyer les documents
            </p>
          )}
          {hasSponsorEmail && !hasInvoice && !hasSheets && !hasCertificate && (
            <p className="text-xs text-muted-foreground text-center">
              Uploadez une facture ou des feuilles d'émargement
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParticipantDocumentsDialog;