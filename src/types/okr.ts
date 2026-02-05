// OKR Module Types

export type OKRTimeTarget = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'S1' | 'S2' | 'annual';

export type OKRCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export type OKRStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type OKRParticipantRole = 'owner' | 'contributor' | 'observer';

export interface OKRObjective {
  id: string;
  title: string;
  description: string | null;
  time_target: OKRTimeTarget;
  target_year: number;
  status: OKRStatus;
  cadence: OKRCadence;
  is_favorite: boolean;
  favorite_position: number | null;
  progress_percentage: number;
  confidence_level: number;
  owner_email: string | null;
  color: string;
  position: number;
  next_review_date: string | null;
  next_review_agenda: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Computed from joins
  key_results?: OKRKeyResult[];
  participants?: OKRParticipant[];
}

export interface OKRKeyResult {
  id: string;
  objective_id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  progress_percentage: number;
  confidence_level: number;
  position: number;
  created_at: string;
  updated_at: string;
  // Computed from joins
  initiatives?: OKRInitiative[];
}

export interface OKRInitiative {
  id: string;
  key_result_id: string;
  title: string;
  description: string | null;
  status: OKRStatus;
  progress_percentage: number;
  linked_mission_id: string | null;
  linked_training_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  // Computed from joins
  linked_mission?: { id: string; title: string } | null;
  linked_training?: { id: string; training_name: string } | null;
}

export interface OKRParticipant {
  id: string;
  objective_id: string;
  email: string;
  name: string | null;
  role: OKRParticipantRole;
  created_at: string;
}

export interface OKRCheckIn {
  id: string;
  objective_id: string;
  check_in_date: string;
  previous_progress: number | null;
  new_progress: number | null;
  previous_confidence: number | null;
  new_confidence: number | null;
  notes: string | null;
  agenda: string | null;
  action_items: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface OKRScheduledEmail {
  id: string;
  objective_id: string;
  scheduled_date: string;
  email_type: 'review_reminder' | 'check_in_summary';
  recipient_emails: string[];
  sent_at: string | null;
  created_at: string;
}

// Input types for creating/updating
export interface CreateOKRObjectiveInput {
  title: string;
  description?: string;
  time_target?: OKRTimeTarget;
  target_year?: number;
  status?: OKRStatus;
  cadence?: OKRCadence;
  owner_email?: string;
  color?: string;
}

export interface UpdateOKRObjectiveInput {
  title?: string;
  description?: string | null;
  time_target?: OKRTimeTarget;
  target_year?: number;
  status?: OKRStatus;
  cadence?: OKRCadence;
  is_favorite?: boolean;
  favorite_position?: number | null;
  progress_percentage?: number;
  confidence_level?: number;
  owner_email?: string | null;
  color?: string;
  position?: number;
  next_review_date?: string | null;
  next_review_agenda?: string | null;
}

export interface CreateOKRKeyResultInput {
  objective_id: string;
  title: string;
  description?: string;
  target_value?: number;
  unit?: string;
}

export interface UpdateOKRKeyResultInput {
  title?: string;
  description?: string | null;
  target_value?: number | null;
  current_value?: number;
  unit?: string | null;
  progress_percentage?: number;
  confidence_level?: number;
  position?: number;
}

export interface CreateOKRInitiativeInput {
  key_result_id: string;
  title: string;
  description?: string;
  linked_mission_id?: string;
  linked_training_id?: string;
}

export interface UpdateOKRInitiativeInput {
  title?: string;
  description?: string | null;
  status?: OKRStatus;
  progress_percentage?: number;
  linked_mission_id?: string | null;
  linked_training_id?: string | null;
  position?: number;
}

export interface CreateOKRCheckInInput {
  objective_id: string;
  new_progress: number;
  new_confidence: number;
  notes?: string;
  agenda?: string;
  action_items?: string;
}

// Configuration objects
export const okrTimeTargetConfig: Record<OKRTimeTarget, { label: string; shortLabel: string }> = {
  Q1: { label: 'Trimestre 1 (Jan-Mars)', shortLabel: 'T1' },
  Q2: { label: 'Trimestre 2 (Avr-Juin)', shortLabel: 'T2' },
  Q3: { label: 'Trimestre 3 (Juil-Sept)', shortLabel: 'T3' },
  Q4: { label: 'Trimestre 4 (Oct-Déc)', shortLabel: 'T4' },
  S1: { label: 'Semestre 1 (Jan-Juin)', shortLabel: 'S1' },
  S2: { label: 'Semestre 2 (Juil-Déc)', shortLabel: 'S2' },
  annual: { label: 'Annuel', shortLabel: 'An' },
};

export const okrCadenceConfig: Record<OKRCadence, { label: string; days: number }> = {
  weekly: { label: 'Hebdomadaire', days: 7 },
  biweekly: { label: 'Bi-hebdomadaire', days: 14 },
  monthly: { label: 'Mensuel', days: 30 },
  quarterly: { label: 'Trimestriel', days: 90 },
};

export const okrStatusConfig: Record<OKRStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: '#6b7280' },
  active: { label: 'Actif', color: '#3b82f6' },
  completed: { label: 'Terminé', color: '#22c55e' },
  cancelled: { label: 'Annulé', color: '#ef4444' },
};

// Confidence level colors
export const getConfidenceColor = (level: number): string => {
  if (level >= 70) return '#22c55e'; // green
  if (level >= 40) return '#eab308'; // yellow
  return '#ef4444'; // red
};

// Progress level colors
export const getProgressColor = (progress: number): string => {
  if (progress >= 80) return '#22c55e'; // green
  if (progress >= 50) return '#3b82f6'; // blue
  if (progress >= 25) return '#eab308'; // yellow
  return '#ef4444'; // red
};
