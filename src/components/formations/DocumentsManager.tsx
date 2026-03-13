import { useState, useEffect } from "react";
import { Upload, FileText, Trash2, Loader2, Send, Receipt, ClipboardList, Mail, Link, Heart, CheckCircle, FileDown, Scroll, PenLine, Shield, ChevronDown, ChevronUp, Eye, BellRing, Award, RotateCw, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatSentDateTime, formatDateTimeSeconds } from "@/lib/dateFormatters";
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
import ThankYouEmailPreviewDialog from "@/components/formations/ThankYouEmailPreviewDialog";
import AttendanceSheetGenerator from "@/components/formations/AttendanceSheetGenerator";
import { sanitizeFileName } from "@/lib/file-utils";

interface DocumentSentInfo {
  invoice: string | null;
  sheets: string | null;
  thankYou: string | null;
}

interface ConventionSignatureStatus {
  status: string;
  signed_at: string | null;
  signer_name: string | null;
  signer_function: string | null;
  ip_address: string | null;
  signature_hash: string | null;
  pdf_hash: string | null;
  proof_file_url: string | null;
  proof_hash: string | null;
  signed_pdf_url: string | null;
  journey_events: JourneyEvent[] | null;
  consent_timestamp: string | null;
}

interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface VerificationResult {
  signature_id: string;
  status: string;
  signed_at: string | null;
  signer_name: string | null;
  checks: Record<string, { status: string; detail: string }>;
  summary: {
    total_checks: number;
    conforme: number;
    non_conforme: number;
    partiel_ou_absent: number;
    overall: string;
  };
}

interface DocumentsManagerProps {
  trainingId: string;
  trainingName: string;
  startDate: string | null;
  endDate: string | null;
  invoiceFileUrl: string | null;
  attendanceSheetsUrls: string[];
  sponsorEmail: string | null;
  sponsorName: string | null;
  sponsorFirstName: string | null;
  sponsorFormalAddress: boolean;
  supportsUrl: string | null;
  evaluationLink: string;
  formatFormation?: string | null;
  isInterEntreprise?: boolean;
  conventionFileUrl?: string | null;
  trainerName: string;
  location: string;
  schedules: { day_date: string; start_time: string; end_time: string }[];
  participants: { id: string; first_name: string | null; last_name: string | null; email: string }[];
  signedConventionUrls?: string[];
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
  formatFormation,
  isInterEntreprise: isInterEntrepriseProp,
  conventionFileUrl: initialConventionUrl,
  trainerName,
  location,
  schedules,
  participants,
  signedConventionUrls: initialSignedConventionUrls,
  onUpdate,
}: DocumentsManagerProps) => {
  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(initialInvoiceUrl);
  const [attendanceSheetsUrls, setAttendanceSheetsUrls] = useState<string[]>(initialSheetsUrls);
  const [supportsUrl, setSupportsUrl] = useState<string>(initialSupportsUrl || "");
  const [conventionFileUrl, setConventionFileUrl] = useState<string | null>(initialConventionUrl || null);
  const [documentsSentInfo, setDocumentsSentInfo] = useState<DocumentSentInfo>({ invoice: null, sheets: null, thankYou: null });
  
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [savingSupportsUrl, setSavingSupportsUrl] = useState(false);
  const [generatingConvention, setGeneratingConvention] = useState(false);
  const [sendingConvention, setSendingConvention] = useState(false);
  const [conventionSentAt, setConventionSentAt] = useState<string | null>(null);
  const [lastGeneratedConventionFileName, setLastGeneratedConventionFileName] = useState<string | null>(null);
  const [enableOnlineSignature, setEnableOnlineSignature] = useState(true);
  const [conventionSignatureUrl, setConventionSignatureUrl] = useState<string | null>(null);
  const [conventionSignatureStatus, setConventionSignatureStatus] = useState<ConventionSignatureStatus | null>(null);
  const [signedConventionUrls, setSignedConventionUrls] = useState<string[]>(initialSignedConventionUrls || []);
  const [uploadingSignedConvention, setUploadingSignedConvention] = useState(false);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [sendingConventionReminder, setSendingConventionReminder] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<"invoice" | "sheets" | "certificates" | "all" | null>(null);
  const [certificateUrls, setCertificateUrls] = useState<string[]>([]);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  // Sync props to local state when parent re-fetches data
  useEffect(() => { setAttendanceSheetsUrls(initialSheetsUrls); }, [initialSheetsUrls]);
  useEffect(() => { setInvoiceFileUrl(initialInvoiceUrl); }, [initialInvoiceUrl]);
  useEffect(() => { setSignedConventionUrls(initialSignedConventionUrls || []); }, [initialSignedConventionUrls]);

  // Fetch document send dates from activity logs
  useEffect(() => {
    const fetchDocumentsSentInfo = async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at, action_type, details")
        .in("action_type", ["training_documents_sent", "thank_you_email_sent", "convention_email_sent"])
        .order("created_at", { ascending: false });

      if (error || !data) return;

      let invoiceSentAt: string | null = null;
      let sheetsSentAt: string | null = null;
      let thankYouSentAt: string | null = null;
      let conventionSent: string | null = null;

      for (const log of data) {
        const details = log.details as { training_id?: string; document_type?: string } | null;
        if (details?.training_id !== trainingId) continue;
        
        if (log.action_type === "convention_email_sent") {
          if (!conventionSent) {
            conventionSent = log.created_at;
          }
        } else if (log.action_type === "thank_you_email_sent") {
          if (!thankYouSentAt) {
            thankYouSentAt = log.created_at;
          }
        } else if (log.action_type === "training_documents_sent") {
          const docType = details?.document_type;
          if (!invoiceSentAt && (docType === "invoice" || docType === "all")) {
            invoiceSentAt = log.created_at;
          }
          if (!sheetsSentAt && (docType === "sheets" || docType === "all")) {
            sheetsSentAt = log.created_at;
          }
        }
        
        if (invoiceSentAt && sheetsSentAt && thankYouSentAt && conventionSent) break;
      }

      setDocumentsSentInfo({ invoice: invoiceSentAt, sheets: sheetsSentAt, thankYou: thankYouSentAt });
      setConventionSentAt(conventionSent);
    };

    fetchDocumentsSentInfo();
  }, [trainingId]);

  // Fetch convention signature status
  useEffect(() => {
    const fetchConventionSignatureStatus = async () => {
      const { data, error } = await supabase
        .from("convention_signatures")
        .select("status, signed_at, audit_metadata, ip_address, proof_file_url, proof_hash, signed_pdf_url, journey_events, pdf_hash")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const audit = data.audit_metadata as Record<string, any> | null;
        setConventionSignatureStatus({
          status: data.status,
          signed_at: data.signed_at,
          signer_name: audit?.signer_name || null,
          signer_function: audit?.signer_function || null,
          ip_address: data.ip_address,
          signature_hash: audit?.signature_hash || null,
          pdf_hash: data.pdf_hash,
          proof_file_url: data.proof_file_url,
          proof_hash: data.proof_hash,
          signed_pdf_url: data.signed_pdf_url,
          journey_events: data.journey_events as unknown as JourneyEvent[] | null,
          consent_timestamp: audit?.consent_timestamp || null,
        });
      }
    };

    fetchConventionSignatureStatus();
  }, [trainingId]);

  // Fetch certificate URLs for all participants
  useEffect(() => {
    const fetchCertificates = async () => {
      const { data, error } = await supabase
        .from("training_evaluations")
        .select("certificate_url, first_name, last_name")
        .eq("training_id", trainingId)
        .not("certificate_url", "is", null);

      if (!error && data) {
        const urls = data
          .map((e: any) => e.certificate_url as string)
          .filter(Boolean);
        setCertificateUrls(urls);
      }
    };

    fetchCertificates();
  }, [trainingId, participants]);

  const hasCertificates = certificateUrls.length > 0;

  const formatSentDate = formatSentDateTime;

  const formatFullDate = formatDateTimeSeconds;

  const journeyEventLabels: Record<string, string> = {
    page_loaded: "Page ouverte",
    first_link_opened: "Premier accès au lien",
    link_reopened: "Lien réouvert",
    pdf_consulted: "PDF consulté",
    signer_name_entered: "Nom saisi",
    signature_drawing_started: "Début de signature",
    signature_cleared: "Signature effacée",
    consent_checkbox_checked: "Consentement coché",
    consent_checkbox_unchecked: "Consentement décoché",
    submit_button_clicked: "Bouton signer cliqué",
    signature_submitted_server: "Signature enregistrée (serveur)",
  };

  const handleVerifySignature = async () => {
    setVerifying(true);
    try {
      const { data: sigData } = await supabase
        .from("convention_signatures")
        .select("id")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sigData) {
        toast({ title: "Erreur", description: "Aucune signature trouvée", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("verify-convention-signature", {
        body: { signatureId: sigData.id },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setVerificationResult(response.data as VerificationResult);
      toast({ title: "Vérification terminée", description: `Résultat : ${(response.data as VerificationResult).summary?.overall || "OK"}` });
    } catch (err) {
      console.error("Verification error:", err);
      toast({ title: "Erreur de vérification", description: err instanceof Error ? err.message : "Erreur inconnue", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  // Upload signed convention files
  const handleSignedConventionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingSignedConvention(true);

    try {
      const newUrls: string[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.includes("pdf") && !file.type.includes("image")) {
          toast({
            title: "Format non supporté",
            description: "Seuls les fichiers PDF et images sont acceptés.",
            variant: "destructive",
          });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const baseName = file.name.replace(`.${fileExt}`, "");
        const sanitizedName = sanitizeFileName(baseName);
        const fileName = `${trainingId}/convention_signee_${Date.now()}_${sanitizedName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("training-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("training-documents")
          .getPublicUrl(fileName);

        newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        const allUrls = [...signedConventionUrls, ...newUrls];

        const { error: updateError } = await supabase
          .from("trainings")
          .update({ signed_convention_urls: allUrls })
          .eq("id", trainingId);

        if (updateError) throw updateError;

        setSignedConventionUrls(allUrls);
        onUpdate?.();

        toast({
          title: "Convention signée uploadée",
          description: `${newUrls.length} fichier(s) ajouté(s).`,
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSignedConvention(false);
      e.target.value = "";
    }
  };

  const handleDeleteSignedConvention = async (urlToDelete: string) => {
    try {
      const updatedUrls = signedConventionUrls.filter(url => url !== urlToDelete);

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ signed_convention_urls: updatedUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      const path = urlToDelete.split("/training-documents/")[1];
      if (path) {
        await supabase.storage.from("training-documents").remove([path]);
      }

      setSignedConventionUrls(updatedUrls);
      onUpdate?.();

      toast({
        title: "Fichier supprimé",
        description: "La convention signée a été retirée.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le fichier.",
        variant: "destructive",
      });
    }
  };

  const handleSendConventionReminder = async () => {
    setSendingConventionReminder(true);
    try {
      const { error } = await supabase.functions.invoke("send-convention-reminder", {
        body: { trainingId },
      });

      if (error) throw error;

      toast({
        title: "Relance envoyée",
        description: `Une relance convention a été envoyée à ${sponsorEmail}.`,
      });
    } catch (error: any) {
      console.error("Error sending convention reminder:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la relance.",
        variant: "destructive",
      });
    } finally {
      setSendingConventionReminder(false);
    }
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    const validFiles: File[] = [];
    
    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (allowedTypes.includes(file.type)) {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length === 0) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF et images (JPG, PNG, GIF, WebP) sont acceptés.",
        variant: "destructive",
      });
      return;
    }
    
    if (validFiles.length < files.length) {
      toast({
        title: "Fichiers ignorés",
        description: `${files.length - validFiles.length} fichier(s) ignoré(s) car non supporté(s).`,
        variant: "default",
      });
    }

    setUploadingSheet(true);

    try {
      const uploadedUrls: string[] = [];
      
      for (const file of validFiles) {
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
          
        uploadedUrls.push(publicUrl);
      }

      const newSheetsUrls = [...attendanceSheetsUrls, ...uploadedUrls];

      // Save directly to database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title: validFiles.length > 1 ? "Feuilles d'émargement uploadées" : "Feuille d'émargement uploadée",
        description: `${validFiles.length} document(s) ajouté(s) à la formation.`,
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
      // Reset input to allow re-selecting the same files
      e.target.value = "";
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

  const handleSendDocuments = async (type: "invoice" | "sheets" | "certificates" | "all", recipientEmail?: string, cc?: string) => {
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

  const openThankYouPreview = () => {
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
      
      // Update local sent info immediately
      setDocumentsSentInfo(prev => ({ ...prev, thankYou: new Date().toISOString() }));
      
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

  // Generate Convention de Formation (for intra)
  const handleGenerateConvention = async () => {
    if (isInterEntreprise || formatFormation === "e_learning" || formatFormation === "inter") {
      toast({
        title: "Non disponible",
        description: "Pour les formations inter-entreprises et e-learning, la convention se génère par participant.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingConvention(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
        body: {
          trainingId,
          subrogation: false, // Default, can be made configurable
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.pdfUrl) {
        // Update convention URL immediately in local state
        setConventionFileUrl(data.pdfUrl);
        setLastGeneratedConventionFileName(data.fileName || null);

        // Download with custom filename via blob
        try {
          const response = await fetch(data.pdfUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.fileName || "Convention.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch {
          // Fallback to direct download
          window.location.href = data.pdfUrl;
        }

        toast({
          title: "Convention générée",
          description: "La convention de formation a été générée et le téléchargement a démarré.",
        });

        onUpdate?.();
      }
    } catch (error: any) {
      console.error("Convention generation error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer la convention.",
        variant: "destructive",
      });
    } finally {
      setGeneratingConvention(false);
    }
  };

  // Send convention to sponsor
  const handleSendConvention = async () => {
    if (!conventionFileUrl || !sponsorEmail) {
      toast({
        title: "Impossible",
        description: !conventionFileUrl
          ? "Aucune convention générée."
          : "Aucun email de commanditaire défini.",
        variant: "destructive",
      });
      return;
    }

    setSendingConvention(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-convention-email", {
        body: {
          trainingId,
          conventionUrl: conventionFileUrl,
          recipientEmail: sponsorEmail,
          recipientName: sponsorName,
          recipientFirstName: sponsorFirstName,
          formalAddress: sponsorFormalAddress,
          conventionFileName: lastGeneratedConventionFileName,
          enableOnlineSignature,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setConventionSentAt(new Date().toISOString());

      if (data?.signatureUrl) {
        setConventionSignatureUrl(data.signatureUrl);
      }

      toast({
        title: "Convention envoyée",
        description: enableOnlineSignature
          ? `Convention envoyée à ${sponsorEmail} avec lien de signature en ligne.`
          : `La convention a été envoyée à ${sponsorEmail}.`,
      });
    } catch (error: any) {
      console.error("Send convention error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error.message || "Impossible d'envoyer la convention.",
        variant: "destructive",
      });
    } finally {
      setSendingConvention(false);
    }
  };

  const openCustomRecipientDialog = (type: "invoice" | "sheets" | "certificates" | "all", toSponsor: boolean = false) => {
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
          {/* 1. Convention de Formation Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Scroll className="h-4 w-4" />
                Convention de formation
              </Label>
              {!isInterEntreprise && formatFormation !== "e_learning" && formatFormation !== "inter" && (
                <div className="flex items-center gap-0.5">
                  {!conventionFileUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateConvention}
                      disabled={generatingConvention}
                    >
                      {generatingConvention ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Générer
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={generatingConvention || sendingConvention}>
                          {generatingConvention || sendingConvention ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Scroll className="h-4 w-4 mr-2" />
                          )}
                          Convention
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={conventionFileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />Télécharger
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleGenerateConvention} disabled={generatingConvention}>
                          <RotateCw className="h-4 w-4 mr-2" />Regénérer
                        </DropdownMenuItem>
                        {sponsorEmail && (
                          <DropdownMenuItem onClick={handleSendConvention} disabled={sendingConvention}>
                            <Send className="h-4 w-4 mr-2" />Envoyer
                          </DropdownMenuItem>
                        )}
                        {conventionSentAt && conventionSignatureStatus?.status !== "signed" && signedConventionUrls.length === 0 && (
                          <DropdownMenuItem onClick={handleSendConventionReminder} disabled={sendingConventionReminder}>
                            {sendingConventionReminder ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
                            Relancer convention
                          </DropdownMenuItem>
                        )}
                        {conventionSignatureStatus?.status !== "signed" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Label htmlFor="signed-convention-upload" className="cursor-pointer flex items-center">
                                <Upload className="h-4 w-4 mr-2" />Uploader signée
                              </Label>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
            {conventionFileUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted/50 border border-border rounded-md">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <a
                    href={conventionFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground hover:underline flex-1 truncate"
                  >
                    Convention générée
                  </a>
                </div>

                {/* Online signature option */}
                {sponsorEmail && (
                  <div className="flex items-center space-x-2 pl-1">
                    <Checkbox
                      id="enableOnlineSignature"
                      checked={enableOnlineSignature}
                      onCheckedChange={(checked) => setEnableOnlineSignature(checked === true)}
                    />
                    <Label htmlFor="enableOnlineSignature" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                      <PenLine className="h-3 w-3" />
                      Proposer la signature en ligne (en plus du PDF joint)
                    </Label>
                  </div>
                )}

                {conventionSentAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Envoyée le {formatSentDate(conventionSentAt)} à {sponsorEmail}
                  </span>
                )}
                {conventionSignatureUrl && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <PenLine className="h-3 w-3 text-primary" />
                    Lien de signature en ligne envoyé
                  </span>
                )}

                {/* Convention signature status + audit panel */}
                {conventionSignatureStatus?.status === "signed" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          Convention signée en ligne
                        </span>
                        {conventionSignatureStatus.signer_name && (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                            par {conventionSignatureStatus.signer_name}
                          </span>
                        )}
                        {conventionSignatureStatus.signed_at && (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                            le {formatSentDate(conventionSignatureStatus.signed_at)}
                          </span>
                        )}
                      </div>
                      {conventionSignatureStatus.signed_pdf_url && (
                        <a href={conventionSignatureStatus.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <FileDown className="h-3 w-3" /> PDF signé
                          </Button>
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setShowAuditPanel(!showAuditPanel)}
                      >
                        <Shield className="h-3 w-3" />
                        Preuve
                        {showAuditPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>

                    {/* Audit / Proof Panel */}
                    {showAuditPanel && (
                      <div className="p-3 bg-muted/30 border border-border rounded-md space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Dossier de preuve</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleVerifySignature}
                            disabled={verifying}
                          >
                            {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                            Vérifier l'intégrité
                          </Button>
                        </div>

                        {/* Signer info */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-muted-foreground">Signataire</span>
                          <span className="font-medium">{conventionSignatureStatus.signer_name || "—"}</span>
                          {conventionSignatureStatus.signer_function && (
                            <>
                              <span className="text-muted-foreground">Fonction</span>
                              <span>{conventionSignatureStatus.signer_function}</span>
                            </>
                          )}
                          <span className="text-muted-foreground">Date de signature</span>
                          <span>{conventionSignatureStatus.signed_at ? formatFullDate(conventionSignatureStatus.signed_at) : "—"}</span>
                          <span className="text-muted-foreground">Adresse IP</span>
                          <span className="font-mono">{conventionSignatureStatus.ip_address || "—"}</span>
                          <span className="text-muted-foreground">Consentement donné</span>
                          <span>{conventionSignatureStatus.consent_timestamp ? formatFullDate(conventionSignatureStatus.consent_timestamp) : "—"}</span>
                        </div>

                        {/* Hashes */}
                        <div className="space-y-1">
                          <span className="font-semibold">Empreintes numériques</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-muted-foreground">Signature (SHA-256)</span>
                            <span className="font-mono truncate" title={conventionSignatureStatus.signature_hash || undefined}>
                              {conventionSignatureStatus.signature_hash ? conventionSignatureStatus.signature_hash.substring(0, 24) + "..." : "—"}
                            </span>
                            <span className="text-muted-foreground">Document PDF</span>
                            <span className="font-mono truncate" title={conventionSignatureStatus.pdf_hash || undefined}>
                              {conventionSignatureStatus.pdf_hash ? conventionSignatureStatus.pdf_hash.substring(0, 24) + "..." : "—"}
                            </span>
                            <span className="text-muted-foreground">Dossier de preuve</span>
                            <span className="font-mono truncate" title={conventionSignatureStatus.proof_hash || undefined}>
                              {conventionSignatureStatus.proof_hash ? conventionSignatureStatus.proof_hash.substring(0, 24) + "..." : "—"}
                            </span>
                          </div>
                        </div>

                        {/* Journey timeline */}
                        {conventionSignatureStatus.journey_events && conventionSignatureStatus.journey_events.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-semibold">Parcours du signataire ({conventionSignatureStatus.journey_events.length} événements)</span>
                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                              {conventionSignatureStatus.journey_events.map((evt, i) => (
                                <div key={i} className="flex items-center gap-2 py-0.5">
                                  <span className="text-muted-foreground font-mono w-32 shrink-0">
                                    {format(parseISO(evt.timestamp), "HH:mm:ss", { locale: fr })}
                                  </span>
                                  <span>{journeyEventLabels[evt.event] || evt.event}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification results */}
                        {verificationResult && (
                          <div className="space-y-2 border-t pt-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Résultat de vérification</span>
                              <span className={`font-semibold ${
                                verificationResult.summary.overall === "CONFORME" ? "text-green-600" :
                                verificationResult.summary.overall === "NON CONFORME" ? "text-red-600" :
                                "text-yellow-600"
                              }`}>
                                {verificationResult.summary.overall}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {verificationResult.summary.conforme}/{verificationResult.summary.total_checks} conformes
                              {verificationResult.summary.non_conforme > 0 && `, ${verificationResult.summary.non_conforme} non conformes`}
                              {verificationResult.summary.partiel_ou_absent > 0 && `, ${verificationResult.summary.partiel_ou_absent} partiels`}
                            </div>
                            <div className="space-y-0.5">
                              {Object.entries(verificationResult.checks).map(([key, check]) => (
                                <div key={key} className="flex items-start gap-2">
                                  <span className="shrink-0">{check.status.split(" ")[0]}</span>
                                  <span className="text-muted-foreground">{check.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Upload signed convention (manual) - hidden input, triggered from dropdown */}
                {conventionSignatureStatus?.status !== "signed" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      multiple
                      onChange={handleSignedConventionUpload}
                      disabled={uploadingSignedConvention}
                      className="hidden"
                      id="signed-convention-upload"
                    />

                    {signedConventionUrls.length > 0 && (
                      <div className="space-y-1">
                        {signedConventionUrls.map((url, index) => {
                          const fileName = decodeURIComponent(url.split("/").pop() || `Fichier ${index + 1}`);
                          return (
                            <div key={index} className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded text-xs">
                              <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:underline flex-1 truncate"
                              >
                                {fileName}
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={() => handleDeleteSignedConvention(url)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {formatFormation === "intra" ? (
              <p className="text-xs text-muted-foreground">
                Génère une convention de formation pour l'ensemble des participants (intra-entreprise)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pour les formations inter-entreprises et e-learning, la convention se génère par participant
                (via l'icône convention dans la liste des participants)
              </p>
            )}
          </div>

          {/* 2. Supports URL */}
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

          {/* 3. Attendance Sheets Section (with generator + manual upload) */}
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
              <div className="flex items-center gap-2">
                <AttendanceSheetGenerator
                  trainingName={trainingName}
                  trainerName={trainerName}
                  location={location}
                  startDate={startDate}
                  endDate={endDate}
                  schedules={schedules}
                  participants={participants}
                />
                <div>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*"
                    multiple
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

          {/* 4. Invoice Section - Hidden for inter-entreprise (invoices managed per participant) */}
          {isInterEntreprise ? (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Les factures sont gérées par participant (cliquez sur l'icône facture dans la liste des participants)
              </p>
            </div>
          ) : (
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
          )}

          {/* Send Documents Section - For inter-entreprise, only show sheets (invoices managed per participant) */}
          <div className="pt-4 border-t space-y-3">
            {isInterEntreprise ? (
              // Inter-entreprise: attendance sheets + certificates can be sent globally
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
                        Feuilles d'émargement
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
              // Standard: full send options
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
                            Feuilles d'émargement
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
                Uploadez une facture ou des feuilles d'émargement pour les envoyer
              </p>
            )}
            {isInterEntreprise && attendanceSheetsUrls.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Uploadez des feuilles d'émargement pour les envoyer. Les factures sont gérées par participant.
              </p>
            )}
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

    </>
  );
};

export default DocumentsManager;
