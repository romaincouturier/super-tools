import { useState, useEffect } from "react";
import { FileText, Link } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ConventionSection, AttendanceSheetSection, InvoiceSection,
  DocumentDeliverySection, ThankYouEmailSection,
} from "./documents";
import { useDocumentsFetch } from "./documents/useDocumentsFetch";
import type { DocumentsManagerProps } from "./documents";

const DocumentsManager = ({
  trainingId, trainingName, startDate, endDate,
  invoiceFileUrl: initialInvoiceUrl,
  attendanceSheetsUrls: initialSheetsUrls,
  sponsorEmail, sponsorName, sponsorFirstName, sponsorFormalAddress,
  supportsUrl: initialSupportsUrl, evaluationLink, formatFormation,
  isInterEntreprise: isInterEntrepriseProp,
  conventionFileUrl: initialConventionUrl,
  trainerName, location, schedules, participants,
  signedConventionUrls: initialSignedConventionUrls, onUpdate,
}: DocumentsManagerProps) => {
  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(initialInvoiceUrl);
  const [attendanceSheetsUrls, setAttendanceSheetsUrls] = useState<string[]>(initialSheetsUrls);
  const [supportsUrl, setSupportsUrl] = useState<string>(initialSupportsUrl || "");
  const [conventionFileUrl, setConventionFileUrl] = useState<string | null>(initialConventionUrl || null);
  const [signedConventionUrls, setSignedConventionUrls] = useState<string[]>(initialSignedConventionUrls || []);
  const [savingSupportsUrl, setSavingSupportsUrl] = useState(false);
  const { toast } = useToast();

  const {
    documentsSentInfo, setDocumentsSentInfo,
    conventionSentAt, setConventionSentAt,
    conventionSignatureStatus, conventionSignatureUrl, setConventionSignatureUrl,
    certificateUrls, evaluationCount, saveSupportsUrl,
  } = useDocumentsFetch({ trainingId, participants });

  useEffect(() => { setAttendanceSheetsUrls(initialSheetsUrls); }, [initialSheetsUrls]);
  useEffect(() => { setInvoiceFileUrl(initialInvoiceUrl); }, [initialInvoiceUrl]);
  useEffect(() => { setSignedConventionUrls(initialSignedConventionUrls || []); }, [initialSignedConventionUrls]);

  void evaluationLink;

  const handleSupportsUrlBlur = async () => {
    if (supportsUrl === (initialSupportsUrl || "")) return;
    setSavingSupportsUrl(true);
    try {
      await saveSupportsUrl(supportsUrl);
      onUpdate?.();
      toast({ title: "Lien enregistré", description: "Le lien vers les supports a été mis à jour." });
    } catch (error: unknown) {
      console.error("Save error:", error);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible d'enregistrer le lien.", variant: "destructive" });
    } finally {
      setSavingSupportsUrl(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />Documents et communication
          </CardTitle>
          <CardDescription>Gérez les documents administratifs et les communications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConventionSection
            trainingId={trainingId} isInterEntreprise={isInterEntreprise} formatFormation={formatFormation}
            conventionFileUrl={conventionFileUrl} setConventionFileUrl={setConventionFileUrl}
            sponsorEmail={sponsorEmail} sponsorName={sponsorName} sponsorFirstName={sponsorFirstName}
            sponsorFormalAddress={sponsorFormalAddress} conventionSentAt={conventionSentAt}
            setConventionSentAt={setConventionSentAt} conventionSignatureStatus={conventionSignatureStatus}
            conventionSignatureUrl={conventionSignatureUrl} setConventionSignatureUrl={setConventionSignatureUrl}
            signedConventionUrls={signedConventionUrls} setSignedConventionUrls={setSignedConventionUrls}
            onUpdate={onUpdate}
          />
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Link className="h-4 w-4" />Lien vers les supports de formation</Label>
            <div className="flex items-center gap-2">
              <Input type="url" value={supportsUrl} onChange={(e) => setSupportsUrl(e.target.value)} onBlur={handleSupportsUrlBlur} placeholder="https://drive.google.com/..." disabled={savingSupportsUrl} />
              {savingSupportsUrl && <Spinner />}
            </div>
          </div>
          <AttendanceSheetSection
            trainingId={trainingId} trainingName={trainingName} trainerName={trainerName}
            location={location} startDate={startDate} endDate={endDate} schedules={schedules}
            participants={participants} attendanceSheetsUrls={attendanceSheetsUrls}
            setAttendanceSheetsUrls={setAttendanceSheetsUrls} sheetsSentAt={documentsSentInfo.sheets}
            onUpdate={onUpdate}
          />
          <InvoiceSection
            trainingId={trainingId} isInterEntreprise={isInterEntreprise} invoiceFileUrl={invoiceFileUrl}
            setInvoiceFileUrl={setInvoiceFileUrl} invoiceSentAt={documentsSentInfo.invoice} onUpdate={onUpdate}
          />
          <DocumentDeliverySection
            trainingId={trainingId} trainingName={trainingName} startDate={startDate} endDate={endDate}
            isInterEntreprise={isInterEntreprise} invoiceFileUrl={invoiceFileUrl}
            attendanceSheetsUrls={attendanceSheetsUrls} certificateUrls={certificateUrls}
            sponsorEmail={sponsorEmail} sponsorName={sponsorName} sponsorFirstName={sponsorFirstName}
            sponsorFormalAddress={sponsorFormalAddress} documentsSentInfo={documentsSentInfo}
            setDocumentsSentInfo={setDocumentsSentInfo} evaluationCount={evaluationCount}
          />
        </CardContent>
      </Card>
      <ThankYouEmailSection
        trainingId={trainingId} trainingName={trainingName} supportsUrl={supportsUrl}
        documentsSentInfo={documentsSentInfo} setDocumentsSentInfo={setDocumentsSentInfo}
      />
    </>
  );
};

export default DocumentsManager;
