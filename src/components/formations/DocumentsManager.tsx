import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ConventionSection, AttendanceSheetSection, InvoiceSection,
  DocumentDeliverySection, ThankYouEmailSection, SupportsSection,
} from "./documents";
import { useDocumentsFetch } from "./documents/useDocumentsFetch";
import type { DocumentsManagerProps } from "./documents";

const DocumentsManager = ({
  trainingId, trainingName, startDate, endDate,
  invoiceFileUrl: initialInvoiceUrl,
  attendanceSheetsUrls: initialSheetsUrls,
  sponsorEmail, sponsorName, sponsorFirstName, sponsorFormalAddress,
  supportsUrl: initialSupportsUrl,
  supportsType: initialSupportsType,
  supportsFileName: initialSupportsFileName,
  supportsLmsCourseId: initialSupportsLmsCourseId,
  evaluationLink, formatFormation,
  isInterEntreprise: isInterEntrepriseProp,
  conventionFileUrl: initialConventionUrl,
  trainerName, location, schedules, participants,
  signedConventionUrls: initialSignedConventionUrls, onUpdate,
}: DocumentsManagerProps) => {
  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(initialInvoiceUrl);
  const [attendanceSheetsUrls, setAttendanceSheetsUrls] = useState<string[]>(initialSheetsUrls);
  const [conventionFileUrl, setConventionFileUrl] = useState<string | null>(initialConventionUrl || null);
  const [signedConventionUrls, setSignedConventionUrls] = useState<string[]>(initialSignedConventionUrls || []);

  const {
    documentsSentInfo, setDocumentsSentInfo,
    conventionSentAt, setConventionSentAt,
    conventionSignatureStatus, conventionSignatureUrl, setConventionSignatureUrl,
    certificateUrls, evaluationCount,
    saveSupportsUrl, saveSupportsType, saveSupportsFile, saveSupportsLmsCourseId,
  } = useDocumentsFetch({ trainingId, participants });

  useEffect(() => { setAttendanceSheetsUrls(initialSheetsUrls); }, [initialSheetsUrls]);
  useEffect(() => { setInvoiceFileUrl(initialInvoiceUrl); }, [initialInvoiceUrl]);
  useEffect(() => { setSignedConventionUrls(initialSignedConventionUrls || []); }, [initialSignedConventionUrls]);

  void evaluationLink;

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
          <SupportsSection
            trainingId={trainingId}
            initialType={initialSupportsType}
            initialUrl={initialSupportsUrl}
            initialFileName={initialSupportsFileName}
            initialLmsCourseId={initialSupportsLmsCourseId}
            saveSupportsType={saveSupportsType}
            saveSupportsUrl={saveSupportsUrl}
            saveSupportsFile={saveSupportsFile}
            saveSupportsLmsCourseId={saveSupportsLmsCourseId}
            onUpdate={onUpdate}
          />
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
        trainingId={trainingId} trainingName={trainingName} supportsUrl={initialSupportsUrl || ""}
        documentsSentInfo={documentsSentInfo} setDocumentsSentInfo={setDocumentsSentInfo}
      />
    </>
  );
};

export default DocumentsManager;
