import { useState, useEffect, useCallback } from "react";
import { FileText, Upload, Trash2, Loader2, Send, Receipt, Mail, User, ClipboardList, Award, RefreshCw } from "lucide-react";
import { resolveContentType } from "@/lib/file-utils";
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
import { exportAttendancePdf } from "./attendance/attendancePdfExport";

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
  const [hasDigitalSignatures, setHasDigitalSignatures] = useState(false);
  const [generatingSheetsPdf, setGeneratingSheetsPdf] = useState(false);
  const [localSheetsUrls, setLocalSheetsUrls] = useState<string[]>(attendanceSheetsUrls);
  const { toast } = useToast();

  useEffect(() => {
    setInvoiceFileUrl(participant.invoice_file_url);
  }, [participant.invoice_file_url]);

  useEffect(() => {
    setLocalSheetsUrls(attendanceSheetsUrls);
  }, [attendanceSheetsUrls]);

  // Fetch certificate + check digital signatures
  useEffect(() => {
    const fetchData = async () => {
      const [certResult, sigResult, trainingResult] = await Promise.all([
        supabase
          .from("training_evaluations")
          .select("certificate_url")
          .eq("training_id", trainingId)
          .eq("participant_id", participant.id)
          .not("certificate_url", "is", null)
          .maybeSingle(),
        supabase
          .from("attendance_signatures")
          .select("id")
          .eq("training_id", trainingId)
          .limit(1),
        supabase
          .from("trainings")
          .select("attendance_sheets_urls")
          .eq("id", trainingId)
          .single(),
      ]);

      setCertificateUrl(certResult.data?.certificate_url as string | null ?? null);
      setHasDigitalSignatures((sigResult.data?.length ?? 0) > 0);
      setLocalSheetsUrls((trainingResult.data?.attendance_sheets_urls as string[]) || []);
    };

    if (open) fetchData();
  }, [trainingId, participant.id, open]);

  const handleGenerateSheetsPdf = useCallback(async () => {
    setGeneratingSheetsPdf(true);
    try {
      const result = await exportAttendancePdf({
        trainingId,
        trainingName,
        startDate,
        onUpdate: () => {
          // Refetch the updated URLs
          supabase
            .from("trainings")
            .select("attendance_sheets_urls")
            .eq("id", trainingId)
            .single()
            .then(({ data }) => {
              const urls = (data?.attendance_sheets_urls as string[]) || [];
              setLocalSheetsUrls(urls);
              onUpdate();
            });
        },
      });
      if (result.success) {
        toast({ title: "PDF généré", description: "La feuille d'émargement numérique a été générée." });
      } else {
        toast({ title: "Aucune donnée", description: result.message, variant: "destructive" });
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Erreur inconnue", variant: "destructive" });
    } finally {
      setGeneratingSheetsPdf(false);
    }
  }, [trainingId, trainingName, startDate, onUpdate, toast]);

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
  const hasSheets = localSheetsUrls.length > 0;
  const hasCertificate = Boolean(certificateUrl);
  const hasSponsorEmail = Boolean(participant.sponsor_email);
  const canSendDocuments = hasSponsorEmail && (hasInvoice || hasSheets || hasDigitalSignatures || hasCertificate);

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!resolveContentType(file).includes("pdf")) {
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

    if (type === "sheets" && !hasSheets && !hasDigitalSignatures) {
      toast({
        title: "Pas de feuilles",
        description: "Aucune feuille d'émargement n'a été uploadée pour cette formation.",
        variant: "destructive",
      });
      return;
    }

    if (type === "all" && !hasInvoice && !hasSheets && !hasDigitalSignatures && !hasCertificate) {
      toast({
        title: "Pas de documents",
        description: "Aucun document n'est disponible.",
        variant: "destructive",
      });
      return;
    }

    setSendingDocuments(true);

    try {
      // Auto-generate digital attendance PDF if needed
      let sheetsToSend = type === "invoice" || type === "certificates" ? [] : [...localSheetsUrls];
      if ((type === "sheets" || type === "all") && sheetsToSend.length === 0 && hasDigitalSignatures) {
        await handleGenerateSheetsPdf();
        // Refetch URLs after generation
        const { data: refreshed } = await supabase
          .from("trainings")
          .select("attendance_sheets_urls")
          .eq("id", trainingId)
          .single();
        sheetsToSend = (refreshed?.attendance_sheets_urls as string[]) || [];
        setLocalSheetsUrls(sheetsToSend);
      }

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
          attendanceSheetsUrls: sheetsToSend,
          certificateUrls: (type === "certificates" || type === "all") && certificateUrl ? [certificateUrl] : [],
          ccEmail: ccEmail || null,
          participantId: participant.id,
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
      <DialogContent className="sm:max-w-md overflow-hidden">
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
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg min-w-0 overflow-hidden">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <a
                  href={invoiceFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-primary hover:underline truncate min-w-0 block"
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
              Feuilles d'émargement ({localSheetsUrls.length})
            </Label>
            {hasSheets ? (
              <p className="text-xs text-muted-foreground">
                Les feuilles d'émargement sont partagées pour toute la formation.
              </p>
            ) : hasDigitalSignatures ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Des émargements numériques existent. Générez le PDF pour l'envoyer.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generatingSheetsPdf}
                  onClick={handleGenerateSheetsPdf}
                >
                  {generatingSheetsPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Générer le PDF d'émargement
                </Button>
              </div>
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
                {(hasSheets || hasDigitalSignatures) && (
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
                {((hasInvoice ? 1 : 0) + ((hasSheets || hasDigitalSignatures) ? 1 : 0) + (hasCertificate ? 1 : 0)) >= 2 && (
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
          {hasSponsorEmail && !hasInvoice && !hasSheets && !hasDigitalSignatures && !hasCertificate && (
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
