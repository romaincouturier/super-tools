export type DocumentType = "invoice" | "sheets" | "certificates" | "evaluations" | "all";

export interface DocumentSentInfo {
  invoice: string | null;
  sheets: string | null;
  thankYou: string | null;
}

export interface ConventionSignatureStatus {
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

export interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface VerificationResult {
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

export interface DocumentsManagerProps {
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
