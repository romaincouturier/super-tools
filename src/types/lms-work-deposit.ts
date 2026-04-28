/**
 * Domain types for the "Dépôt de travail" feature (ST-2026-0043).
 *
 * The feature lets learners submit a piece of work (file + optional comment)
 * tied to a lesson, choose whether it stays private or is shared with peers,
 * and later receive feedback from SuperTilt.
 */

export type DepositVisibility = "private" | "shared";

export type DepositPublicationStatus = "published" | "hidden";

export type DepositPedagogicalStatus =
  | "submitted"
  | "seen"
  | "feedback_received"
  | "needs_completion"
  | "validated";

export type DepositCommentStatus = "published" | "hidden" | "deleted";

export type DepositFormat = "jpg" | "png" | "pdf" | "video";

export const DEFAULT_DEPOSIT_FORMATS: DepositFormat[] = ["jpg", "png", "pdf", "video"];
export const DEFAULT_DEPOSIT_MAX_SIZE_MB = 50;

/** JSONB config carried by lms_lessons.work_deposit_config. */
export interface WorkDepositConfig {
  title?: string;
  instructions_html?: string | null;
  expected_deliverable?: string | null;
  accepted_formats?: DepositFormat[];
  max_size_mb?: number;
  sharing_allowed?: boolean;
  comments_enabled?: boolean;
  feedback_enabled?: boolean;
}

/** Defaults applied client-side when a config field is missing. */
export const DEFAULT_WORK_DEPOSIT_CONFIG: Required<WorkDepositConfig> = {
  title: "Déposer mon travail",
  instructions_html: null,
  expected_deliverable: null,
  accepted_formats: DEFAULT_DEPOSIT_FORMATS,
  max_size_mb: DEFAULT_DEPOSIT_MAX_SIZE_MB,
  sharing_allowed: true,
  comments_enabled: true,
  feedback_enabled: true,
};

export function withDepositDefaults(config: WorkDepositConfig | null | undefined): Required<WorkDepositConfig> {
  return { ...DEFAULT_WORK_DEPOSIT_CONFIG, ...(config || {}) };
}

export interface WorkDeposit {
  id: string;
  lesson_id: string;
  course_id: string;
  module_id: string | null;
  learner_email: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  comment: string | null;
  visibility: DepositVisibility;
  publication_status: DepositPublicationStatus;
  pedagogical_status: DepositPedagogicalStatus;
  visibility_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkDepositInput {
  lesson_id: string;
  course_id: string;
  module_id?: string | null;
  learner_email: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  comment?: string | null;
  visibility: DepositVisibility;
}

export interface UpdateWorkDepositInput {
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  comment?: string | null;
  visibility?: DepositVisibility;
  publication_status?: DepositPublicationStatus;
  pedagogical_status?: DepositPedagogicalStatus;
}

export interface DepositComment {
  id: string;
  deposit_id: string;
  author_email: string;
  content: string;
  status: DepositCommentStatus;
  created_at: string;
  updated_at: string;
}

export interface DepositFeedback {
  id: string;
  deposit_id: string;
  author_id: string | null;
  content: string;
  email_sent: boolean;
  created_at: string;
  updated_at: string;
}

/** Map from format key to MIME prefixes accepted by <input accept>. */
export const FORMAT_MIME_ACCEPT: Record<DepositFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  video: "video/*",
};

export const FORMAT_LABELS: Record<DepositFormat, string> = {
  jpg: "JPG",
  png: "PNG",
  pdf: "PDF",
  video: "Vidéo",
};

export const PEDAGOGICAL_STATUS_LABELS: Record<DepositPedagogicalStatus, string> = {
  submitted: "Déposé",
  seen: "Vu par SuperTilt",
  feedback_received: "Retour reçu",
  needs_completion: "À compléter",
  validated: "Validé",
};

export const VISIBILITY_LABELS: Record<DepositVisibility, string> = {
  private: "Privé",
  shared: "Partagé",
};

/** Returns true if the file mime is allowed by the configured formats. */
export function isFileFormatAllowed(mime: string, accepted: DepositFormat[]): boolean {
  for (const fmt of accepted) {
    const accept = FORMAT_MIME_ACCEPT[fmt];
    if (accept.endsWith("/*") && mime.startsWith(accept.slice(0, -1))) return true;
    if (accept === mime) return true;
  }
  return false;
}
