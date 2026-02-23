import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type {
  DocumentSentInfo,
  ConventionSignatureStatus,
  JourneyEvent,
  VerificationResult,
  DocumentsManagerProps,
} from "./DocumentsManager.types";

export function useDocumentsManager({
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
  formatFormation,
  conventionFileUrl: initialConventionUrl,
  signedConventionUrls: initialSignedConventionUrls,
  onUpdate,
}: DocumentsManagerProps) {
  const isInterEntreprise =
    formatFormation === "inter-entreprises" || formatFormation === "e_learning";
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(initialInvoiceUrl);
  const [attendanceSheetsUrls, setAttendanceSheetsUrls] = useState<string[]>(initialSheetsUrls);
  const [supportsUrl, setSupportsUrl] = useState<string>(initialSupportsUrl || "");
  const [conventionFileUrl, setConventionFileUrl] = useState<string | null>(
    initialConventionUrl || null,
  );
  const [documentsSentInfo, setDocumentsSentInfo] = useState<DocumentSentInfo>({
    invoice: null,
    sheets: null,
    thankYou: null,
  });

  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [sendingThankYou, setSendingThankYou] = useState(false);
  const [savingSupportsUrl, setSavingSupportsUrl] = useState(false);
  const [generatingConvention, setGeneratingConvention] = useState(false);
  const [sendingConvention, setSendingConvention] = useState(false);
  const [conventionSentAt, setConventionSentAt] = useState<string | null>(null);
  const [lastGeneratedConventionFileName, setLastGeneratedConventionFileName] = useState<
    string | null
  >(null);
  const [enableOnlineSignature, setEnableOnlineSignature] = useState(true);
  const [conventionSignatureUrl, setConventionSignatureUrl] = useState<string | null>(null);
  const [conventionSignatureStatus, setConventionSignatureStatus] =
    useState<ConventionSignatureStatus | null>(null);
  const [signedConventionUrls, setSignedConventionUrls] = useState<string[]>(
    initialSignedConventionUrls || [],
  );
  const [uploadingSignedConvention, setUploadingSignedConvention] = useState(false);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [showCustomRecipientDialog, setShowCustomRecipientDialog] = useState(false);
  const [sendingConventionReminder, setSendingConventionReminder] = useState(false);
  const [pendingDocumentType, setPendingDocumentType] = useState<
    "invoice" | "sheets" | "all" | null
  >(null);
  const [sendToSponsorWithOptions, setSendToSponsorWithOptions] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  // Fetch document send dates from activity logs
  useEffect(() => {
    const fetchDocumentsSentInfo = async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at, action_type, details")
        .in("action_type", [
          "training_documents_sent",
          "thank_you_email_sent",
          "convention_email_sent",
        ])
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

      setDocumentsSentInfo({
        invoice: invoiceSentAt,
        sheets: sheetsSentAt,
        thankYou: thankYouSentAt,
      });
      setConventionSentAt(conventionSent);
    };

    fetchDocumentsSentInfo();
  }, [trainingId]);

  // Fetch convention signature status
  useEffect(() => {
    const fetchConventionSignatureStatus = async () => {
      const { data, error } = await supabase
        .from("convention_signatures")
        .select(
          "status, signed_at, audit_metadata, ip_address, proof_file_url, proof_hash, signed_pdf_url, journey_events, pdf_hash",
        )
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const audit = data.audit_metadata as Record<string, unknown> | null;
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

  const formatSentDate = (dateStr: string): string => {
    return format(parseISO(dateStr), "d MMM à HH:mm", { locale: fr });
  };

  const formatFullDate = (dateStr: string): string => {
    return format(parseISO(dateStr), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr });
  };

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
      toast({
        title: "Vérification terminée",
        description: `Résultat : ${(response.data as VerificationResult).summary?.overall || "OK"}`,
      });
    } catch (err) {
      console.error("Verification error:", err);
      toast({
        title: "Erreur de vérification",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[()[\]{}]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
  };

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

        const {
          data: { publicUrl },
        } = supabase.storage.from("training-documents").getPublicUrl(fileName);

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
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSignedConvention(false);
      e.target.value = "";
    }
  };

  const handleDeleteSignedConvention = async (urlToDelete: string) => {
    try {
      const updatedUrls = signedConventionUrls.filter((url) => url !== urlToDelete);

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
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le fichier.",
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
    } catch (error: unknown) {
      console.error("Error sending convention reminder:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la relance.",
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

      const {
        data: { publicUrl },
      } = supabase.storage.from("training-documents").getPublicUrl(fileName);

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
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
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

        const {
          data: { publicUrl },
        } = supabase.storage.from("training-documents").getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      const newSheetsUrls = [...attendanceSheetsUrls, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title:
          validFiles.length > 1
            ? "Feuilles d'émargement uploadées"
            : "Feuille d'émargement uploadée",
        description: `${validFiles.length} document(s) ajouté(s) à la formation.`,
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSheet(false);
      e.target.value = "";
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceFileUrl) return;

    try {
      const urlParts = invoiceFileUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage.from("training-documents").remove([urlParts[1]]);
      }

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
    } catch (error: unknown) {
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
        await supabase.storage.from("training-documents").remove([urlParts[1]]);
      }

      const newSheetsUrls = attendanceSheetsUrls.filter((url) => url !== sheetUrl);

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

  const handleSendDocuments = async (
    type: "invoice" | "sheets" | "all",
    recipientEmail?: string,
    cc?: string,
  ) => {
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

      const now = new Date().toISOString();
      if (type === "invoice" || type === "all") {
        setDocumentsSentInfo((prev) => ({ ...prev, invoice: now }));
      }
      if (type === "sheets" || type === "all") {
        setDocumentsSentInfo((prev) => ({ ...prev, sheets: now }));
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

      setDocumentsSentInfo((prev) => ({ ...prev, thankYou: new Date().toISOString() }));

      setShowThankYouPreview(false);
    } catch (error: unknown) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description:
          error instanceof Error ? error.message : "Impossible d'envoyer le mail de remerciement.",
        variant: "destructive",
      });
    } finally {
      setSendingThankYou(false);
    }
  };

  const handleGenerateConvention = async () => {
    if (isInterEntreprise || formatFormation === "e_learning") {
      toast({
        title: "Non disponible",
        description:
          "Pour les formations inter-entreprises et e-learning, la convention se génère par participant.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingConvention(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
        body: {
          trainingId,
          subrogation: false,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.pdfUrl) {
        setConventionFileUrl(data.pdfUrl);
        setLastGeneratedConventionFileName(data.fileName || null);

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
        } catch (error) {
          console.warn("Blob download failed, falling back to direct download:", error);
          window.location.href = data.pdfUrl;
        }

        toast({
          title: "Convention générée",
          description: "La convention de formation a été générée et le téléchargement a démarré.",
        });

        onUpdate?.();
      }
    } catch (error: unknown) {
      console.error("Convention generation error:", error);
      toast({
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Impossible de générer la convention.",
        variant: "destructive",
      });
    } finally {
      setGeneratingConvention(false);
    }
  };

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
    } catch (error: unknown) {
      console.error("Send convention error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la convention.",
        variant: "destructive",
      });
    } finally {
      setSendingConvention(false);
    }
  };

  const openCustomRecipientDialog = (
    type: "invoice" | "sheets" | "all",
    toSponsor: boolean = false,
  ) => {
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

  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    return fileName.replace(/^\d+_/, "").replace(/_/g, " ");
  };

  return {
    // Derived
    isInterEntreprise,
    // State
    invoiceFileUrl,
    attendanceSheetsUrls,
    supportsUrl,
    setSupportsUrl,
    conventionFileUrl,
    documentsSentInfo,
    uploadingInvoice,
    uploadingSheet,
    sendingDocuments,
    sendingThankYou,
    savingSupportsUrl,
    generatingConvention,
    sendingConvention,
    conventionSentAt,
    enableOnlineSignature,
    setEnableOnlineSignature,
    conventionSignatureUrl,
    conventionSignatureStatus,
    signedConventionUrls,
    uploadingSignedConvention,
    customRecipientEmail,
    setCustomRecipientEmail,
    ccEmail,
    setCcEmail,
    showCustomRecipientDialog,
    setShowCustomRecipientDialog,
    sendingConventionReminder,
    pendingDocumentType,
    sendToSponsorWithOptions,
    showThankYouPreview,
    setShowThankYouPreview,
    showAuditPanel,
    setShowAuditPanel,
    verificationResult,
    verifying,
    // Handlers
    handleVerifySignature,
    handleSignedConventionUpload,
    handleDeleteSignedConvention,
    handleSendConventionReminder,
    handleInvoiceUpload,
    handleSheetUpload,
    handleDeleteInvoice,
    handleDeleteSheet,
    handleSupportsUrlBlur,
    handleSendDocuments,
    openThankYouPreview,
    handleSendThankYouEmail,
    handleGenerateConvention,
    handleSendConvention,
    openCustomRecipientDialog,
    // Utils
    formatSentDate,
    formatFullDate,
    journeyEventLabels,
    getFileNameFromUrl,
  };
}
