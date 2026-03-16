import { HelpCircle } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { differenceInDays, parseISO } from "date-fns";
import { computeEvaluationStats } from "@/lib/evaluationUtils";
import type { EvaluationData } from "@/lib/evaluationUtils";
import {
  ParticipantTable, ParticipantMobileCard, EvaluationSummaryBar,
  ParticipantDialogs, useParticipantData, useParticipantActions,
} from "./participants";
import type { Participant, ParticipantListProps, SortField, SortDirection } from "./participants";

const ParticipantList = ({
  participants, trainingId, trainingName, trainingStartDate, trainingEndDate,
  formatFormation, isInterEntreprise: isInterEntrepriseProp, elearningDuration,
  availableFormulas = [], attendanceSheetsUrls, clientName, trainingDuree, onParticipantUpdated,
}: ParticipantListProps) => {
  const isMobile = useIsMobile();
  const [documentsParticipant, setDocumentsParticipant] = useState<Participant | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationData | null>(null);
  const [showEvaluationDetail, setShowEvaluationDetail] = useState(false);
  const [traceabilityParticipant, setTraceabilityParticipant] = useState<Participant | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const isIndividualConvention = isInterEntreprise;
  const hasCoachingParticipants = participants.some((p) => (p.coaching_sessions_total || 0) > 0);
  const daysUntilTraining = trainingStartDate ? differenceInDays(parseISO(trainingStartDate), new Date()) : null;
  const canSendManually = daysUntilTraining === null || daysUntilTraining <= 2;

  const data = useParticipantData(trainingId, participants, isIndividualConvention);
  const actions = useParticipantActions({
    trainingId, trainingName, trainingStartDate, trainingEndDate, clientName, trainingDuree,
    certificatesByParticipant: data.certificatesByParticipant, conventionSignatures: data.conventionSignatures,
    isIndividualConvention, canSendManually, onParticipantUpdated,
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortField(null); setSortDirection("asc"); }
    } else { setSortField(field); setSortDirection("asc"); }
  };

  const sortedParticipants = useMemo(() => [...participants].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "last_name": return dir * (a.last_name || "").localeCompare(b.last_name || "", "fr");
      case "first_name": return dir * (a.first_name || "").localeCompare(b.first_name || "", "fr");
      case "email": return dir * a.email.localeCompare(b.email, "fr");
      case "amount": return dir * ((a.sold_price_ht || 0) - (b.sold_price_ht || 0));
      default: return 0;
    }
  }), [participants, sortField, sortDirection]);

  const handleViewEvaluation = useCallback((evaluation: EvaluationData) => {
    setSelectedEvaluation(evaluation);
    setShowEvaluationDetail(true);
  }, []);

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Aucun participant inscrit</p>
        <p className="text-sm">Ajoutez des participants pour commencer</p>
      </div>
    );
  }

  const { total: evalTotal, soumis: evalSoumis, envoye: evalEnvoye, avgRating } =
    computeEvaluationStats(data.evaluationsByParticipant, participants.length);

  const sharedActionsProps = {
    trainingId, trainingName, trainingStartDate, trainingEndDate, formatFormation,
    isInterEntreprise, isIndividualConvention, elearningDuration, availableFormulas,
    clientName, trainingDuree, attendanceSheetsUrls,
    sendingId: actions.sendingId, remindingId: actions.remindingId,
    deletingId: actions.deletingId, generatingConventionId: actions.generatingConventionId,
    downloadingConventionId: actions.downloadingConventionId,
    conventionRemindingId: actions.conventionRemindingId,
    generatingCertId: actions.generatingCertId, sendingCertId: actions.sendingCertId,
    conventionSignatures: data.conventionSignatures,
    certificatesByParticipant: data.certificatesByParticipant,
    evaluationsByParticipant: data.evaluationsByParticipant,
    participantsWithSignatures: data.participantsWithSignatures,
    onSendSurvey: actions.handleSendSurvey, onSendReminder: actions.handleSendReminder,
    onDelete: actions.handleDelete, onGenerateConvention: actions.handleGenerateConvention,
    onDownloadConvention: actions.handleDownloadConvention,
    onSendConventionReminder: actions.handleSendConventionReminder,
    onGenerateCertificate: actions.handleGenerateCertificate,
    onSendCertificate: actions.handleSendCertificate,
    onOpenDocuments: setDocumentsParticipant, onOpenTraceability: setTraceabilityParticipant,
    onViewEvaluation: handleViewEvaluation, onParticipantUpdated,
    canSendSurveyFor: actions.canSendSurveyFor, canSendReminderFor: actions.canSendReminderFor,
    canSendConventionReminderFor: actions.canSendConventionReminderFor,
  };

  return (
    <>
      <EvaluationSummaryBar evalTotal={evalTotal} evalSoumis={evalSoumis}
        evalEnvoye={evalEnvoye} avgRating={avgRating} participantCount={participants.length} />
      {isMobile ? (
        <ParticipantMobileCard sortedParticipants={sortedParticipants} {...sharedActionsProps} />
      ) : (
        <ParticipantTable sortedParticipants={sortedParticipants}
          hasCoachingParticipants={hasCoachingParticipants} sortField={sortField}
          sortDirection={sortDirection} onToggleSort={toggleSort}
          onCopyEmail={actions.handleCopyEmail}
          onToggleCoachingSession={actions.handleToggleCoachingSession}
          onUncheckCoachingSession={actions.handleUncheckCoachingSession}
          {...sharedActionsProps} />
      )}
      <ParticipantDialogs
        documentsParticipant={documentsParticipant}
        onCloseDocuments={() => setDocumentsParticipant(null)}
        selectedEvaluation={selectedEvaluation}
        showEvaluationDetail={showEvaluationDetail}
        onEvaluationDetailChange={setShowEvaluationDetail}
        traceabilityParticipant={traceabilityParticipant}
        onCloseTraceability={() => setTraceabilityParticipant(null)}
        trainingId={trainingId} trainingName={trainingName}
        trainingStartDate={trainingStartDate} trainingEndDate={trainingEndDate}
        attendanceSheetsUrls={attendanceSheetsUrls} onParticipantUpdated={onParticipantUpdated}
      />
    </>
  );
};

export default ParticipantList;
