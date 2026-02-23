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
}

export interface ParticipantListProps {
  participants: Participant[];
  trainingId: string;
  trainingName: string;
  trainingStartDate: string;
  trainingEndDate: string | null;
  formatFormation: string | null;
  elearningDuration?: number | null;
  attendanceSheetsUrls: string[];
  clientName: string;
  trainingDuree: string;
  onParticipantUpdated: () => void;
}

export interface CertificateInfo {
  evaluationId: string;
  certificateUrl: string | null;
}

export interface ConventionSignatureInfo {
  status: string;
  signed_at: string | null;
}
