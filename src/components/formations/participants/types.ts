import type { FormationFormula } from "@/types/training";
import type {
  EvaluationInfo,
  CertificateInfo as CertInfo,
} from "@/lib/evaluationUtils";
import type { EvaluationData } from "@/lib/evaluationUtils";

export interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  convention_file_url?: string | null;
  convention_document_id?: string | null;
  signed_convention_url?: string | null;
  elearning_duration?: number | null;
  notes?: string | null;
  formula?: string | null;
  formula_id?: string | null;
  coaching_sessions_total?: number;
  coaching_sessions_completed?: number;
  coaching_deadline?: string | null;
}

export interface ConventionSignatureInfo {
  status: string;
  signed_at: string | null;
}

export interface ParticipantListProps {
  participants: Participant[];
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  trainingLocation: string | null;
  formatFormation: string | null;
  isInterEntreprise?: boolean;
  elearningDuration?: number | null;
  availableFormulas?: FormationFormula[];
  attendanceSheetsUrls: string[];
  clientName: string;
  trainingDuree: string;
  onParticipantUpdated: () => void;
}

export interface ParticipantActionsProps {
  participant: Participant;
  displayName: string;
  trainingId: string;
  trainingName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  trainingLocation: string | null;
  formatFormation: string | null;
  isInterEntreprise: boolean;
  isIndividualConvention: boolean;
  elearningDuration?: number | null;
  availableFormulas: FormationFormula[];
  clientName: string;
  trainingDuree: string;
  attendanceSheetsUrls: string[];
  // Loading states
  sendingId: string | null;
  remindingId: string | null;
  deletingId: string | null;
  generatingConventionId: string | null;
  downloadingConventionId: string | null;
  conventionRemindingId: string | null;
  generatingCertId: string | null;
  sendingCertId: string | null;
  // Data maps
  conventionSignatures: Map<string, ConventionSignatureInfo>;
  certificatesByParticipant: Map<string, CertInfo>;
  evaluationsByParticipant: Map<string, EvaluationInfo>;
  participantsWithSignatures: Set<string>;
  // Handlers
  onSendSurvey: (participant: Participant) => void;
  onSendReminder: (participant: Participant) => void;
  onDelete: (participant: Participant) => void;
  onGenerateConvention: (participant: Participant) => void;
  onDownloadConvention: (participant: Participant) => void;
  onSendConventionReminder: (participant: Participant) => void;
  onGenerateCertificate: (participant: Participant) => void;
  onSendCertificate: (participant: Participant, recipientEmail: string, recipientName: string) => void;
  onOpenDocuments: (participant: Participant) => void;
  onOpenTraceability: (participant: Participant) => void;
  onViewEvaluation: (evaluation: EvaluationData) => void;
  onParticipantUpdated: () => void;
  // Predicates
  canSendSurveyFor: (participant: Participant) => boolean;
  canSendReminderFor: (participant: Participant) => boolean;
  canSendConventionReminderFor: (participant: Participant) => boolean;
}

export type SortField = "last_name" | "first_name" | "email" | "amount";
export type SortDirection = "asc" | "desc";
