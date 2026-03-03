export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  location_type: "physical" | "visio";
  notes: string | null;
  status: "active" | "cancelled";
  cancellation_reason: string | null;
  event_type: "internal" | "external";
  cfp_deadline: string | null;
  event_url: string | null;
  cfp_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CANCELLATION_REASONS = [
  { value: "non_selectionne", label: "Non sélectionné" },
  { value: "plus_disponible", label: "Plus disponible" },
  { value: "manque_participants", label: "Pas assez de participants" },
  { value: "report", label: "Reporté" },
  { value: "autre", label: "Autre" },
] as const;

export function getCfpDaysLeft(cfpDeadline: string): number {
  const deadline = new Date(cfpDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface EventMedia {
  id: string;
  event_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video_link";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  created_by: string | null;
  created_at: string;
}
