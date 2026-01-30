import { useState, useEffect } from "react";
import { Upload, FileText, Trash2, Loader2, Send, Receipt, ClipboardList, Mail, Link, Heart, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentSentInfo {
  invoice: string | null;
  sheets: string | null;
}

interface DocumentsManagerProps {
  trainingId: string;
  trainingName: string;
  startDate: string;
  endDate: string | null;
  invoiceFileUrl: string | null;
  attendanceSheetsUrls: string[];
  sponsorEmail: string | null;
  sponsorName: string | null;
  sponsorFirstName: string | null;
  sponsorFormalAddress: boolean;
  supportsUrl: string | null;
  evaluationLink: string;
  onUpdate?: () => void;
}

const DocumentsManager = ({
  trainingId,
  trainingName,
  startDate,
  endDate,
  invoiceFileUrl: initialInvoiceUrl,
  attendanceSheetsUrls: initialSheetsUrls,
  sponsorEmail,
  sponsorName,
  sponsorFirstName,
  sponsorFormalAddress,
  supportsUrl: initialSupportsUrl,
  evaluationLink,
  onUpdate,
}: DocumentsManagerProps) => {
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(initialInvoiceUrl);
  const [attendanceSheetsUrls, setAttendanceSheetsUrls] = useState<string[]>(initialSheetsUrls);
  const [supportsUrl, setSupportsUrl] = useState<string>(initialSupportsUrl || "");
  const [documentsSentInfo, setDocumentsSentInfo] = useState<DocumentSentInfo>({ invoice: null, sheets: null });
  
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [savingSupportsUrl, setSavingSupportsUrl] = useState(false);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<"invoice" | "sheets" | "all" | null>(null);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch document send dates from activity logs
  useEffect(() => {
    const fetchDocumentsSentInfo = async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at, details")
        .eq("action_type", "training_documents_sent")
        .order("created_at", { ascending: false });

      if (error || !data) return;

      // Filter logs for this training and find latest send dates
      let invoiceSentAt: string | null = null;
      let sheetsSentAt: string | null = null;

      for (const log of data) {
        const details = log.details as { training_id?: string; document_type?: string } | null;
        if (details?.training_id !== trainingId) continue;
        
        const docType = details?.document_type;
        
        // Invoice sent (either "invoice" or "all")
        if (!invoiceSentAt && (docType === "invoice" || docType === "all")) {
          invoiceSentAt = log.created_at;
        }
        
        // Sheets sent (either "sheets" or "all")
        if (!sheetsSentAt && (docType === "sheets" || docType === "all")) {
          sheetsSentAt = log.created_at;
        }
        
        // Stop once we have both
        if (invoiceSentAt && sheetsSentAt) break;
      }

      setDocumentsSentInfo({ invoice: invoiceSentAt, sheets: sheetsSentAt });
    };

    fetchDocumentsSentInfo();
  }, [trainingId]);

  const formatSentDate = (dateStr: string): string => {
    return format(parseISO(dateStr), "d MMM à HH:mm", { locale: fr });
  };

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[()[\]{}]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
  };

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
      const fileName = `${trainingId}/facture_${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);

      // Save directly to database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({ invoice_file_url: publicUrl })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setInvoiceFileUrl(publicUrl);
      onUpdate?.();

      toast({
        title: "Facture uploadée",
        description: "La facture a été ajoutée à la formation.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF et images (JPG, PNG, GIF, WebP) sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    setUploadingSheet(true);

    try {
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "");
      const sanitizedName = sanitizeFileName(baseName);
      const fileName = `${trainingId}/emargement_${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);

      const newSheetsUrls = [...attendanceSheetsUrls, publicUrl];

      // Save directly to database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title: "Feuille d'émargement uploadée",
        description: "Le document a été ajouté à la formation.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSheet(false);
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

      // Save directly to database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({ invoice_file_url: null })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setInvoiceFileUrl(null);
      onUpdate?.();

      toast({
        title: "Facture supprimée",
        description: "La facture a été retirée de la formation.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la facture.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSheet = async (sheetUrl: string) => {
    try {
      const urlParts = sheetUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("training-documents")
          .remove([urlParts[1]]);
      }

      const newSheetsUrls = attendanceSheetsUrls.filter((url) => url !== sheetUrl);

      // Save directly to database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title: "Feuille supprimée",
        description: "Le document a été retiré de la formation.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document.",
        variant: "destructive",
      });
    }
  };

  const handleSupportsUrlBlur = async () => {
    if (supportsUrl === (initialSupportsUrl || "")) return;
    
    setSavingSupportsUrl(true);
    try {
      const { error } = await supabase
        .from("trainings")
        .update({ supports_url: supportsUrl || null })
        .eq("id", trainingId);

      if (error) throw error;
      
      onUpdate?.();
      
      toast({
        title: "Lien enregistré",
        description: "Le lien vers les supports a été mis à jour.",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le lien.",
        variant: "destructive",
      });
    } finally {
      setSavingSupportsUrl(false);
    }
  };

  const handleSendDocuments = async (type: "invoice" | "sheets" | "all", recipientEmail?: string, cc?: string) => {
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
          invoiceUrl: type === "sheets" ? null : invoiceFileUrl,
          attendanceSheetsUrls: type === "invoice" ? [] : attendanceSheetsUrls,
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
      
      // Update local sent info immediately
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
    } catch (error: any) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error.message || "Impossible d'envoyer les documents.",
        variant: "destructive",
      });
    } finally {
      setSendingDocuments(false);
    }
  };

  const openThankYouPreview = async () => {
    // Fetch participants for this training
    const { data: participants } = await supabase
      .from("training_participants")
      .select("email")
      .eq("training_id", trainingId);
    
    if (participants) {
      setParticipantEmails(participants.map(p => p.email));
    }
    setShowThankYouPreview(true);
  };

  const handleSendThankYouEmail = async () => {
    setSendingThankYou(true);

    try {
      const { error, data } = await supabase.functions.invoke("send-thank-you-email", {
        body: { trainingId },
      });

      if (error) throw error;

      toast({
        title: "Email de remerciement envoyé",
        description: `Le mail a été envoyé à ${data.recipientCount} participant(s).`,
      });
      
      setShowThankYouPreview(false);
    } catch (error: any) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error.message || "Impossible d'envoyer le mail de remerciement.",
        variant: "destructive",
      });
    } finally {
      setSendingThankYou(false);
    }
  };

  const getThankYouEmailContent = () => {
    const supportsSection = supportsUrl 
      ? `\nVous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :\n${supportsUrl}\n`
      : "";
    
    return `Bonjour à toutes et à tous,

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "${trainingName}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
${evaluationLink}
${supportsSection}
Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée

—
Romain Couturier
romain@supertilt.fr`;
  };

  const openCustomRecipientDialog = (type: "invoice" | "sheets" | "all", toSponsor: boolean = false) => {
    setPendingDocumentType(type);
    setSendToSponsorWithOptions(toSponsor);
    if (toSponsor && sponsorEmail) {
      setCustomRecipientEmail(sponsorEmail);
      setCcEmail("");
    } else {
      setCustomRecipientEmail("");
      // Pre-fill CC with sponsor email when sending to another recipient
      setCcEmail(sponsorEmail || "");
    }
    setShowCustomRecipientDialog(true);
  };

  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    return fileName.replace(/^\d+_/, "").replace(/_/g, " ");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents et communication
          </CardTitle>
          <CardDescription>
            Gérez les documents administratifs et les communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supports URL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Lien vers les supports de formation
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                value={supportsUrl}
                onChange={(e) => setSupportsUrl(e.target.value)}
                onBlur={handleSupportsUrlBlur}
                placeholder="https://drive.google.com/..."
                disabled={savingSupportsUrl}
              />
              {savingSupportsUrl && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>

          {/* Invoice Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Facture
                </Label>
                {documentsSentInfo.invoice && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Envoyée le {formatSentDate(documentsSentInfo.invoice)}
                  </span>
                )}
              </div>
              {!invoiceFileUrl && (
                <div>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleInvoiceUpload}
                    disabled={uploadingInvoice}
                    className="hidden"
                    id="invoice-upload"
                  />
                  <Label htmlFor="invoice-upload" className="cursor-pointer">
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
                        Uploader
                      </span>
                    </Button>
                  </Label>
                </div>
              )}
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

          {/* Attendance Sheets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Feuilles d'émargement ({attendanceSheetsUrls.length})
                </Label>
                {documentsSentInfo.sheets && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Envoyées le {formatSentDate(documentsSentInfo.sheets)}
                  </span>
                )}
              </div>
              <div>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*"
                  onChange={handleSheetUpload}
                  disabled={uploadingSheet}
                  className="hidden"
                  id="sheet-upload"
                />
                <Label htmlFor="sheet-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingSheet}
                    asChild
                  >
                    <span>
                      {uploadingSheet ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Ajouter
                    </span>
                  </Button>
                </Label>
              </div>
            </div>

            {attendanceSheetsUrls.length > 0 && (
              <div className="space-y-2">
                {attendanceSheetsUrls.map((url, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-primary hover:underline truncate"
                    >
                      Feuille {index + 1} - {getFileNameFromUrl(url)}
                    </a>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette feuille ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteSheet(url)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send Documents Section */}
          {(invoiceFileUrl || attendanceSheetsUrls.length > 0) && (
            <div className="pt-4 border-t space-y-3">
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
                          Feuilles d'émargement
                        </DropdownMenuItem>
                      )}
                      {invoiceFileUrl && attendanceSheetsUrls.length > 0 && (
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
                  {invoiceFileUrl && attendanceSheetsUrls.length > 0 && (
                    <DropdownMenuItem onClick={() => openCustomRecipientDialog("all", false)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Tous → autre email
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Thank You Email Section */}
          <div className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={openThankYouPreview}
              disabled={sendingThankYou}
            >
              {sendingThankYou ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Heart className="h-4 w-4 mr-2" />
              )}
              Envoyer le mail de remerciement
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Envoi à tous les participants inscrits
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custom Recipient Dialog */}
      <Dialog open={showCustomRecipientDialog} onOpenChange={setShowCustomRecipientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sendToSponsorWithOptions ? "Envoyer au commanditaire" : "Envoyer à un autre destinataire"}
            </DialogTitle>
            <DialogDescription>
              {sendToSponsorWithOptions 
                ? `Envoi de ${pendingDocumentType === "invoice" ? "la facture" : pendingDocumentType === "sheets" ? "les feuilles d'émargement" : "tous les documents"} au commanditaire. Vous pouvez ajouter un email en copie.`
                : `Entrez l'adresse email du destinataire pour ${pendingDocumentType === "invoice" ? "la facture" : pendingDocumentType === "sheets" ? "les feuilles d'émargement" : "tous les documents"}.`
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
                  // If sending to sponsor, pass undefined for recipientEmail so sponsorName is used
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

      {/* Thank You Email Preview Dialog */}
      <Dialog open={showThankYouPreview} onOpenChange={setShowThankYouPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Prévisualisation du mail de remerciement
            </DialogTitle>
            <DialogDescription>
              Vérifiez le contenu avant envoi
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">De</p>
              <p className="font-medium">Romain Couturier &lt;romain@supertilt.fr&gt;</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">À</p>
              <div className="flex flex-wrap gap-1">
                {participantEmails.length > 0 ? (
                  participantEmails.map((email, index) => (
                    <span key={index} className="text-sm bg-muted px-2 py-1 rounded">
                      {email}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Chargement...</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {participantEmails.length} participant{participantEmails.length > 1 ? "s" : ""}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Objet</p>
              <p className="font-medium">Merci pour votre participation à la formation {trainingName}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Contenu</p>
              <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm font-mono">
                {getThankYouEmailContent()}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowThankYouPreview(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSendThankYouEmail}
              disabled={sendingThankYou || participantEmails.length === 0}
            >
              {sendingThankYou ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Envoyer à {participantEmails.length} participant{participantEmails.length > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentsManager;
