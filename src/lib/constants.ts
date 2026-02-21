// Training format types
export const TRAINING_FORMATS = {
  INTRA: "intra",
  INTER: "inter-entreprises",
  ELEARNING: "e_learning",
} as const;

export type TrainingFormat = (typeof TRAINING_FORMATS)[keyof typeof TRAINING_FORMATS];

export const TRAINING_FORMAT_LABELS: Record<string, string> = {
  intra: "Intra-entreprise",
  "inter-entreprises": "Inter-entreprises",
  e_learning: "E-learning",
};

// Participant survey statuses
export const SURVEY_STATUS = {
  NOT_SENT: "non_envoye",
  SCHEDULED: "programme",
  MANUAL: "manuel",
  SENT: "envoye",
  COMPLETE: "complete",
} as const;

// Default delay values (in days)
export const DEFAULT_DELAYS = {
  NEEDS_SURVEY: "7",
  REMINDER: "7",
  TRAINER_SUMMARY: "1",
  GOOGLE_REVIEW: "1",
  VIDEO_TESTIMONIAL: "3",
  COLD_EVALUATION: "10",
  COLD_EVALUATION_FUNDER: "15",
  EVALUATION_REMINDER_1: "2",
  EVALUATION_REMINDER_2: "5",
  CONVENTION_REMINDER_1: "3",
  CONVENTION_REMINDER_2: "7",
} as const;

// Default URLs
export const DEFAULT_URLS = {
  GOOGLE_MY_BUSINESS: "https://g.page/r/CWJ0W_P6C-BJEAE/review",
  SUPERTILT_SITE: "https://supertilt.fr",
  WEBSITE: "https://www.supertilt.fr",
  YOUTUBE: "https://www.youtube.com/@supertilt",
  BLOG: "https://supertilt.fr/blog/",
} as const;

// Timeouts (in ms)
export const TIMEOUTS = {
  AUTH_SAFETY: 8000,
  COPY_FEEDBACK: 2000,
} as const;

// Default TVA rate
export const DEFAULT_TVA_RATE = "20";

// Default working days [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
export const DEFAULT_WORKING_DAYS = [false, true, true, true, true, true, false];

// Training locations
export const TRAINING_LOCATIONS = [
  "En ligne en accédant à son compte sur supertilt.fr",
  "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon",
  "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris",
  "Chez le client",
] as const;

// Predefined location options for training form
export const PREDEFINED_LOCATIONS = [
  { value: "en_ligne", label: "En ligne en accédant à son compte sur supertilt.fr" },
  { value: "lyon", label: "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon" },
  { value: "paris", label: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" },
  { value: "chez_client", label: "Chez le client (adresse du client)" },
  { value: "autre", label: "Autre" },
] as const;

// Payment modes for inter-enterprise
export const PAYMENT_MODES = {
  INVOICE: "invoice",
  PREPAID: "prepaid",
} as const;

// Duration calculation: sessions ≤4h count as 3.5h, sessions >4h count as 7h
export const DURATION_THRESHOLDS = {
  HALF_DAY_MAX_HOURS: 4,
  HALF_DAY_NORMALIZED: 3.5,
  FULL_DAY_NORMALIZED: 7,
} as const;

// All setting keys used in app_settings table
export const SETTING_KEYS = [
  "sender_email",
  "sender_name",
  "evaluation_notification_email",
  "bcc_email",
  "bcc_enabled",
  "working_days",
  "google_my_business_url",
  "supertilt_site_url",
  "newsletter_tool_url",
  "website_url",
  "youtube_url",
  "blog_url",
  "tva_rate",
  "delay_needs_survey_days",
  "delay_reminder_days",
  "delay_trainer_summary_days",
  "delay_google_review_days",
  "delay_video_testimonial_days",
  "delay_cold_evaluation_days",
  "delay_cold_evaluation_funder_days",
  "delay_evaluation_reminder_1_days",
  "delay_evaluation_reminder_2_days",
  "delay_convention_reminder_1_days",
  "delay_convention_reminder_2_days",
  "can_delete_evaluations_emails",
  "reglement_interieur_url",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
