import type { EvaluationData } from "@/lib/evaluationUtils";
import ParticipantDocumentsDialog from "../ParticipantDocumentsDialog";
import EvaluationDetailDialog from "../EvaluationDetailDialog";
import ParticipantTraceabilityDrawer from "../ParticipantTraceabilityDrawer";
import type { Participant } from "./types";

interface ParticipantDialogsProps {
  documentsParticipant: Participant | null;
  onCloseDocuments: () => void;
  selectedEvaluation: EvaluationData | null;
  showEvaluationDetail: boolean;
  onEvaluationDetailChange: (open: boolean) => void;
  traceabilityParticipant: Participant | null;
  onCloseTraceability: () => void;
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  attendanceSheetsUrls: string[];
  onParticipantUpdated: () => void;
}

const ParticipantDialogs = ({
  documentsParticipant,
  onCloseDocuments,
  selectedEvaluation,
  showEvaluationDetail,
  onEvaluationDetailChange,
  traceabilityParticipant,
  onCloseTraceability,
  trainingId,
  trainingName,
  trainingStartDate,
  trainingEndDate,
  attendanceSheetsUrls,
  onParticipantUpdated,
}: ParticipantDialogsProps) => {
  return (
    <>
      {documentsParticipant && (
        <ParticipantDocumentsDialog
          open={!!documentsParticipant}
          onOpenChange={(open) => !open && onCloseDocuments()}
          participant={{
            id: documentsParticipant.id,
            first_name: documentsParticipant.first_name,
            last_name: documentsParticipant.last_name,
            email: documentsParticipant.email,
            company: documentsParticipant.company,
            sponsor_first_name: documentsParticipant.sponsor_first_name || null,
            sponsor_last_name: documentsParticipant.sponsor_last_name || null,
            sponsor_email: documentsParticipant.sponsor_email || null,
            invoice_file_url: documentsParticipant.invoice_file_url || null,
          }}
          trainingId={trainingId}
          trainingName={trainingName}
          startDate={trainingStartDate || ""}
          endDate={trainingEndDate}
          attendanceSheetsUrls={attendanceSheetsUrls}
          onUpdate={onParticipantUpdated}
        />
      )}

      <EvaluationDetailDialog
        open={showEvaluationDetail}
        onOpenChange={onEvaluationDetailChange}
        evaluation={selectedEvaluation}
        trainingName={trainingName}
      />

      {traceabilityParticipant && (
        <ParticipantTraceabilityDrawer
          open={!!traceabilityParticipant}
          onOpenChange={(open) => !open && onCloseTraceability()}
          participantId={traceabilityParticipant.id}
          participantEmail={traceabilityParticipant.email}
          participantName={
            traceabilityParticipant.first_name || traceabilityParticipant.last_name
              ? `${traceabilityParticipant.first_name || ""} ${traceabilityParticipant.last_name || ""}`.trim()
              : traceabilityParticipant.email
          }
          trainingId={trainingId}
          trainingName={trainingName}
        />
      )}
    </>
  );
};

export default ParticipantDialogs;
