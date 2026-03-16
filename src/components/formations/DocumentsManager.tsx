import { useState, useEffect } from "react";
import { FileText, Link, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import {
  ConventionSection,
  AttendanceSheetSection,
  InvoiceSection,
  DocumentDeliverySection,
  ThankYouEmailSection,
} from "./documents";
import type { DocumentSentInfo, ConventionSignatureStatus, JourneyEvent, DocumentsManagerProps } from "./documents";

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

  const [savingSupportsUrl, setSavingSupportsUrl] = useState(false);
  const [conventionSentAt, setConventionSentAt] = useState<string | null>(null);
  const [conventionSignatureUrl, setConventionSignatureUrl] = useState<string | null>(null);
  const [conventionSignatureStatus, setConventionSignatureStatus] = useState<ConventionSignatureStatus | null>(null);
  const [signedConventionUrls, setSignedConventionUrls] = useState<string[]>(initialSignedConventionUrls || []);
  const [certificateUrls, setCertificateUrls] = useState<string[]>([]);
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
        const audit = data.audit_metadata as Record<string, string | null> | null;
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
          .map((e: { certificate_url: string | null }) => e.certificate_url as string)
          .filter(Boolean);
        setCertificateUrls(urls);
      }
    };

    fetchCertificates();
  }, [trainingId, participants]);

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
        description: error instanceof Error ? error.message : "Impossible d'enregistrer le lien.",
        variant: "destructive",
      });
    } finally {
      setSavingSupportsUrl(false);
    }
  };

  // Keep evaluationLink available (used by thank-you email or future features)
  void evaluationLink;

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
          <ConventionSection
            trainingId={trainingId}
            isInterEntreprise={isInterEntreprise}
            formatFormation={formatFormation}
            conventionFileUrl={conventionFileUrl}
            setConventionFileUrl={setConventionFileUrl}
            sponsorEmail={sponsorEmail}
            sponsorName={sponsorName}
            sponsorFirstName={sponsorFirstName}
            sponsorFormalAddress={sponsorFormalAddress}
            conventionSentAt={conventionSentAt}
            setConventionSentAt={setConventionSentAt}
            conventionSignatureStatus={conventionSignatureStatus}
            conventionSignatureUrl={conventionSignatureUrl}
            setConventionSignatureUrl={setConventionSignatureUrl}
            signedConventionUrls={signedConventionUrls}
            setSignedConventionUrls={setSignedConventionUrls}
            onUpdate={onUpdate}
          />

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

          {/* 3. Attendance Sheets Section */}
          <AttendanceSheetSection
            trainingId={trainingId}
            trainingName={trainingName}
            trainerName={trainerName}
            location={location}
            startDate={startDate}
            endDate={endDate}
            schedules={schedules}
            participants={participants}
            attendanceSheetsUrls={attendanceSheetsUrls}
            setAttendanceSheetsUrls={setAttendanceSheetsUrls}
            sheetsSentAt={documentsSentInfo.sheets}
            onUpdate={onUpdate}
          />

          {/* 4. Invoice Section */}
          <InvoiceSection
            trainingId={trainingId}
            isInterEntreprise={isInterEntreprise}
            invoiceFileUrl={invoiceFileUrl}
            setInvoiceFileUrl={setInvoiceFileUrl}
            invoiceSentAt={documentsSentInfo.invoice}
            onUpdate={onUpdate}
          />

          {/* 5. Send Documents Section */}
          <DocumentDeliverySection
            trainingId={trainingId}
            trainingName={trainingName}
            startDate={startDate}
            endDate={endDate}
            isInterEntreprise={isInterEntreprise}
            invoiceFileUrl={invoiceFileUrl}
            attendanceSheetsUrls={attendanceSheetsUrls}
            certificateUrls={certificateUrls}
            sponsorEmail={sponsorEmail}
            sponsorName={sponsorName}
            sponsorFirstName={sponsorFirstName}
            sponsorFormalAddress={sponsorFormalAddress}
            documentsSentInfo={documentsSentInfo}
            setDocumentsSentInfo={setDocumentsSentInfo}
          />
        </CardContent>
      </Card>

      {/* Thank You Email Preview Dialog */}
      <ThankYouEmailSection
        trainingId={trainingId}
        trainingName={trainingName}
        supportsUrl={supportsUrl}
        documentsSentInfo={documentsSentInfo}
        setDocumentsSentInfo={setDocumentsSentInfo}
      />
    </>
  );
};

export default DocumentsManager;
