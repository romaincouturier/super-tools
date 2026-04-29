// Missions Module Types

export type MissionStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_contact: string | null;
  status: MissionStatus;
  start_date: string | null;
  end_date: string | null;
  daily_rate: number | null;
  total_days: number | null;
  total_amount: number | null;
  initial_amount: number | null;
  consumed_amount: number | null;
  billed_amount: number | null;
  tags: string[];
  color: string;
  position: number;
  emoji?: string | null;
  language: string;
  testimonial_status: string;
  testimonial_last_sent_at: string | null;
  location: string | null;
  train_booked: boolean;
  hotel_booked: boolean;
  waiting_next_action_date: string | null;
  waiting_next_action_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  assigned_to: string | null;
}

export interface CreateMissionInput {
  title: string;
  description?: string;
  client_name?: string;
  client_contact?: string;
  status?: MissionStatus;
  start_date?: string;
  end_date?: string;
  daily_rate?: number;
  total_days?: number;
  initial_amount?: number;
  tags?: string[];
  color?: string;
  // Structured contact fields (from CRM)
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  assigned_to?: string | null;
  emoji?: string;
}

export interface UpdateMissionInput {
  title?: string;
  description?: string | null;
  client_name?: string | null;
  client_contact?: string | null;
  status?: MissionStatus;
  start_date?: string | null;
  end_date?: string | null;
  daily_rate?: number | null;
  total_days?: number | null;
  initial_amount?: number | null;
  tags?: string[];
  color?: string;
  position?: number;
  emoji?: string | null;
  language?: string;
  location?: string | null;
  train_booked?: boolean;
  hotel_booked?: boolean;
  waiting_next_action_date?: string | null;
  waiting_next_action_text?: string | null;
  assigned_to?: string | null;
}

export interface MissionContact {
  id: string;
  mission_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  language: string;
  formal_address: boolean;
  is_primary: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

// Status configuration for Kanban columns
export const missionStatusConfig: Record<MissionStatus, { label: string; color: string }> = {
  not_started: { label: 'À démarrer', color: '#6b7280' },
  in_progress: { label: 'En cours', color: '#3b82f6' },
  completed: { label: 'Terminée', color: '#22c55e' },
  cancelled: { label: 'Annulée', color: '#ef4444' },
};
