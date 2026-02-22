// Training domain entities — single source of truth

export interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  client_address: string | null;
  sold_price_ht: number | null;
  evaluation_link: string;
  program_file_url: string | null;
  prerequisites: string[];
  objectives: string[];
  format_formation: string | null;
  created_at: string;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  sponsor_formal_address: boolean;
  participants_formal_address: boolean;
  invoice_file_url: string | null;
  attendance_sheets_urls: string[];
  supports_url: string | null;
  trainer_name: string;
  train_booked: boolean;
  hotel_booked: boolean;
  restaurant_booked: boolean;
  room_rental_booked: boolean;
  convention_file_url?: string | null;
  signed_convention_urls?: string[];
  elearning_duration?: number | null;
  notes?: string | null;
  assigned_to?: string | null;
}

export interface Schedule {
  id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

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
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
}

export interface ScheduledAction {
  id: string;
  description: string;
  dueDate: Date;
  assignedEmail: string;
  assignedName: string;
  completed: boolean;
}
