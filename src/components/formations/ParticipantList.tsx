import { HelpCircle, Search, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail, maskText } from "@/lib/demoMask";
import { filterParticipantsBySearch } from "@/lib/participantSearch";
import { differenceInDays, parseISO } from "date-fns";
import { computeEvaluationStats } from "@/lib/evaluationUtils";
import type { EvaluationData } from "@/lib/evaluationUtils";
import {
  ParticipantTable, ParticipantMobileCard, EvaluationSummaryBar,
  ParticipantDialogs, useParticipantData, useParticipantActions,
} from "./participants";
import type { Participant, ParticipantListProps, SortField, SortDirection } from "./participants";

const ParticipantList = ({
  participants, trainingId, trainingName, trainingStartDate, trainingEndDate, trainingLocation,
  formatFormation, isInterEntreprise: isInterEntrepriseProp,
  availableFormulas = [], attendanceSheetsUrls, clientName, trainingDuree, onParticipantUpdated,
  bpfTrainingHasSource,
  isFreeTraining = false,
}: ParticipantListProps) => {
  const isMobile = useIsMobile();
  const [documentsParticipant, setDocumentsParticipant] = useState<Participant | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationData | null>(null);
  const [showEvaluationDetail, setShowEvaluationDetail] = useState(false);
  const [traceabilityParticipant, setTraceabilityParticipant] = useState<Participant | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");
  const { isDemoMode } = useDemoMode();

  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");
  const isIndividualConvention = isInterEntreprise;
  const hasCoachingParticipants = participants.some((p) => (p.coaching_sessions_total || 0) > 0);
  const daysUntilTraining = trainingStartDate ? differenceInDays(parseISO(trainingStartDate), new Date()) : null;
  const canSendManually = daysUntilTraining === null || daysUntilTraining <= 2;

  const data = useParticipantData(trainingId, participants, isIndividualConvention, formatFormation === "e_learning");
  const actions = useParticipantActions({
    trainingId, trainingName, trainingStartDate, trainingEndDate, clientName, trainingDuree,
    certificatesByParticipant: data.certificatesByParticipant, conventionSignatures: data.conventionSignatures,
    isIndividualConvention, canSendManually, onParticipantUpdated,
  });

  const toggleSort = (field: SortField) => {
    if (isFreeTraining && field === "amount") return;
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortField(null); setSortDirection("asc"); }
    } else { setSortField(field); setSortDirection("asc"); }
  };

  const filteredParticipants = useMemo(
    () => filterParticipantsBySearch(participants, search),
    [participants, search],
  );
  const isFiltering = search.trim().length > 0;

  const sortedParticipants = useMemo(() => [...filteredParticipants].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "last_name": return dir * (a.last_name || "").localeCompare(b.last_name || "", "fr");
      case "first_name": return dir * (a.first_name || "").localeCompare(b.first_name || "", "fr");
      case "email": return dir * a.email.localeCompare(b.email, "fr");
      case "amount": return isFreeTraining ? 0 : dir * ((a.sold_price_ht || 0) - (b.sold_price_ht || 0));
      default: return 0;
    }
  }), [filteredParticipants, sortField, sortDirection]);

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

  // Le terme saisi peut être une adresse email : masqué en mode démo comme tout
  // affichage identifiant d'un écran interne.
  const maskedSearch = isDemoMode
    ? (search.includes("@") ? maskEmail(search) : maskText(search))
    : search;

  const sharedActionsProps = {
    trainingId, trainingName, trainingStartDate, trainingEndDate, trainingLocation, formatFormation,
    isInterEntreprise, isIndividualConvention, availableFormulas,
    clientName, trainingDuree, attendanceSheetsUrls,
    sendingId: actions.sendingId, remindingId: actions.remindingId,
    sendingAccessEmailId: actions.sendingAccessEmailId,
    resendingWelcomeId: actions.resendingWelcomeId,
    deletingId: actions.deletingId, generatingConventionId: actions.generatingConventionId,
    downloadingConventionId: actions.downloadingConventionId,
    conventionRemindingId: actions.conventionRemindingId,
    generatingCertId: actions.generatingCertId, sendingCertId: actions.sendingCertId,
    conventionSignatures: data.conventionSignatures,
    certificatesByParticipant: data.certificatesByParticipant,
    evaluationsByParticipant: data.evaluationsByParticipant,
    participantsWithSignatures: data.participantsWithSignatures,
    participantsWithAccount: data.participantsWithAccount,
    onSendSurvey: actions.handleSendSurvey, onSendReminder: actions.handleSendReminder,
    onSendAccessEmail: actions.handleSendAccessEmail,
    onResendWelcome: actions.handleResendWelcome,
    onDelete: actions.handleDelete, onGenerateConvention: actions.handleGenerateConvention,
    onDownloadConvention: actions.handleDownloadConvention,
    onSendConventionReminder: actions.handleSendConventionReminder,
    onGenerateCertificate: actions.handleGenerateCertificate,
    onSendCertificate: actions.handleSendCertificate,
    onOpenDocuments: setDocumentsParticipant, onOpenTraceability: setTraceabilityParticipant,
    onViewEvaluation: handleViewEvaluation, onParticipantUpdated,
    canSendSurveyFor: actions.canSendSurveyFor, canSendReminderFor: actions.canSendReminderFor,
    canSendConventionReminderFor: actions.canSendConventionReminderFor,
    bpfTrainingHasSource: !!bpfTrainingHasSource,
    isFreeTraining,
  };

  return (
    <>
      <EvaluationSummaryBar evalTotal={evalTotal} evalSoumis={evalSoumis}
        evalEnvoye={evalEnvoye} avgRating={avgRating} participantCount={participants.length} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Rechercher un participant"
            placeholder="Rechercher par email, nom, prénom ou entreprise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {isFiltering && (
            <Button type="button" variant="ghost" size="icon" aria-label="Effacer la recherche"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
              onClick={() => setSearch("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isFiltering && (
          <span className="text-sm text-muted-foreground">
            {filteredParticipants.length} sur {participants.length} participants
          </span>
        )}
      </div>
      {isFiltering && filteredParticipants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-lg">Aucun participant ne correspond à « {maskedSearch} »</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
            Effacer la recherche
          </Button>
        </div>
      ) : isMobile ? (
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
