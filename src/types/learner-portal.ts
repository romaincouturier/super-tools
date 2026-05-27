// ── Types ─────────────────────────────────────────────────────────────────────

export interface NextEvent {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  meeting_type: string;
  duration_minutes?: number | null;
  description?: string | null;
}

export interface Training {
  training_id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  format: string | null;
  participant_id: string;
  first_name: string;
  last_name: string;
  needs_survey_status: string | null;
  evaluation_status: string | null;
  program_file_url?: string | null;
  supports_url?: string | null;
  lms_course_id?: string | null;
  lms_course_title?: string | null;
  lms_completion?: number | null;
  last_lesson_id?: string | null;
  next_event?: NextEvent | null;
  is_coached?: boolean;
  is_permanent?: boolean;
  coaching_sessions_completed?: number;
  coaching_sessions_total?: number;
  trainer_booking_url?: string | null;
  objectives?: string[];
  prerequisites?: string[];
  reglement_interieur_url?: string | null;
  trainer_name?: string | null;
  trainer_photo_url?: string | null;
}

export interface Questionnaire {
  token: string;
  training_id: string;
  etat: string;
}

export interface LearnerData {
  email: string;
  trainings: Training[];
  questionnaires: Questionnaire[];
  evaluations: Questionnaire[];
}

export type NavSection =
  | "dashboard" | "formations" | "recommandees" | "travaux"
  | "pratique" | "pratique_publications" | "pratique_commentaires" | "pratique_likes"
  | "aide" | "compte";

export const SECTION_SLUGS: Record<NavSection, string | null> = {
  dashboard:    "tableau-de-bord",
  formations:   "mes-formations",
  recommandees: "formations-recommandees",
  travaux:      "mes-travaux",
  pratique:     "communaute",
  pratique_publications:  "communaute-mes-publications",
  pratique_commentaires:  "communaute-mes-commentaires",
  pratique_likes:         "communaute-mes-likes",
  aide:         "aide",
  compte:       null,
};

export const SLUG_TO_SECTION: Record<string, NavSection> = {
  "tableau-de-bord":        "dashboard",
  "mes-formations":         "formations",
  "formations-recommandees": "recommandees",
  "mes-travaux":            "travaux",
  "communaute":             "pratique",
  "communaute-mes-publications": "pratique_publications",
  "communaute-mes-commentaires": "pratique_commentaires",
  "communaute-mes-likes":        "pratique_likes",
  "aide":                   "aide",
};

export const PRATIQUE_SECTIONS: NavSection[] = ["pratique", "pratique_publications", "pratique_commentaires", "pratique_likes"];

export const eventTypeLabel: Record<string, string> = {
  launch: "Lancement",
  live: "Live",
  closing: "Dernière séance",
};
