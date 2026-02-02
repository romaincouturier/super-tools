/**
 * Test Fixtures - Mock data for testing
 */

// User fixtures
export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
};

export const mockSession = {
  user: mockUser,
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_at: Date.now() + 3600000,
};

// Organization fixtures
export const mockOrganization = {
  id: "org-123",
  name: "Test Organisation",
  slug: "test-org",
  logo_url: null,
  primary_color: "#6366f1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  settings: {
    website: "https://test.com",
    siret: "12345678900012",
    nda: "11 75 12345 67",
  },
};

// User profile fixtures
export const mockUserProfile = {
  id: "user-123",
  organization_id: "org-123",
  email: "test@example.com",
  first_name: "Jean",
  last_name: "Dupont",
  role: "owner" as const,
  is_active: true,
  last_login_at: "2026-01-15T10:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Subscription fixtures
export const mockSubscription = {
  id: "sub-123",
  organization_id: "org-123",
  plan: "free" as const,
  status: "active" as const,
  monthly_training_limit: 2,
  current_period_start: "2026-01-01T00:00:00Z",
  current_period_end: "2026-02-01T00:00:00Z",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Trainer fixtures
export const mockTrainer = {
  id: "trainer-123",
  organization_id: "org-123",
  user_id: "user-123",
  name: "Jean Dupont",
  email: "test@example.com",
  phone: "0612345678",
  bio: "Formateur expérimenté",
  specialties: ["Management", "Leadership"],
  is_default: true,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Training fixtures
export const mockTraining = {
  id: "training-123",
  organization_id: "org-123",
  trainer_id: "trainer-123",
  training_name: "Formation Management",
  client_name: "Entreprise Test",
  location: "Paris 9e",
  format_formation: "presentiel" as const,
  start_date: "2026-02-15",
  end_date: "2026-02-16",
  trainer_name: "Jean Dupont",
  sponsor_first_name: "Marie",
  sponsor_last_name: "Martin",
  sponsor_email: "marie.martin@test.com",
  use_formal_language: true,
  objectifs_pedagogiques: [
    "Comprendre les fondamentaux du management",
    "Savoir motiver une équipe",
    "Gérer les conflits",
  ],
  prerequis: "Expérience en entreprise souhaitée",
  funder_name: "OPCO Test",
  funder_email: "opco@test.com",
  funder_type: "opco" as const,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
};

// Training schedules fixtures
export const mockTrainingSchedules = [
  {
    id: "schedule-1",
    training_id: "training-123",
    day_date: "2026-02-15",
    start_time: "09:00",
    end_time: "17:30",
  },
  {
    id: "schedule-2",
    training_id: "training-123",
    day_date: "2026-02-16",
    start_time: "09:00",
    end_time: "17:30",
  },
];

// Participant fixtures
export const mockParticipants = [
  {
    id: "participant-1",
    training_id: "training-123",
    organization_id: "org-123",
    email: "participant1@test.com",
    first_name: "Alice",
    last_name: "Bernard",
    company: "Entreprise Test",
    needs_survey_token: "token-1",
    needs_survey_status: "soumis" as const,
    evaluation_token: "eval-token-1",
    evaluation_status: "soumis" as const,
    added_at: "2026-01-10T00:00:00Z",
  },
  {
    id: "participant-2",
    training_id: "training-123",
    organization_id: "org-123",
    email: "participant2@test.com",
    first_name: "Bob",
    last_name: "Charles",
    company: "Entreprise Test",
    needs_survey_token: "token-2",
    needs_survey_status: "soumis" as const,
    evaluation_token: "eval-token-2",
    evaluation_status: "soumis" as const,
    added_at: "2026-01-10T00:00:00Z",
  },
];

// Evaluation fixtures
export const mockEvaluations = [
  {
    id: "eval-1",
    training_id: "training-123",
    organization_id: "org-123",
    participant_id: "participant-1",
    etat: "soumis" as const,
    appreciation_globale: 5,
    equilibre_theorie_pratique: 5,
    rythme_formation: 4,
    qualification_intervenant: 5,
    adaptation_public: 5,
    recommandation_nps: 9,
    objectifs_atteints: { objectif_1: 5, objectif_2: 4, objectif_3: 5 },
    points_forts: "Excellent contenu, très pratique",
    axes_amelioration: ["Plus d'exercices pratiques"],
    created_at: "2026-02-17T00:00:00Z",
    submitted_at: "2026-02-17T10:00:00Z",
  },
  {
    id: "eval-2",
    training_id: "training-123",
    organization_id: "org-123",
    participant_id: "participant-2",
    etat: "soumis" as const,
    appreciation_globale: 4,
    equilibre_theorie_pratique: 4,
    rythme_formation: 4,
    qualification_intervenant: 5,
    adaptation_public: 4,
    recommandation_nps: 8,
    objectifs_atteints: { objectif_1: 4, objectif_2: 4, objectif_3: 4 },
    points_forts: "Formateur très compétent",
    axes_amelioration: ["Documentation à améliorer"],
    created_at: "2026-02-17T00:00:00Z",
    submitted_at: "2026-02-17T11:00:00Z",
  },
];

// Attendance signatures fixtures
export const mockAttendanceSignatures = [
  {
    id: "sig-1",
    training_id: "training-123",
    organization_id: "org-123",
    participant_id: "participant-1",
    schedule_id: "schedule-1",
    period: "am" as const,
    signature: "data:image/png;base64,mockSignature1",
    signed_at: "2026-02-15T09:05:00Z",
    ip_address: "192.168.1.1",
    user_agent: "Mozilla/5.0",
  },
  {
    id: "sig-2",
    training_id: "training-123",
    organization_id: "org-123",
    participant_id: "participant-1",
    schedule_id: "schedule-1",
    period: "pm" as const,
    signature: "data:image/png;base64,mockSignature2",
    signed_at: "2026-02-15T14:05:00Z",
    ip_address: "192.168.1.1",
    user_agent: "Mozilla/5.0",
  },
];

// Usage tracking fixtures
export const mockUsageTracking = {
  id: "usage-1",
  organization_id: "org-123",
  month_year: "2026-01",
  trainings_created: 1,
  participants_added: 2,
  emails_sent: 10,
  certificates_generated: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

// BPF data fixture
export const mockBpfData = {
  year: 2026,
  organization: mockOrganization,
  stats: {
    total_trainings: 5,
    total_participants: 25,
    total_hours: 80,
    by_format: {
      presentiel: 3,
      distanciel: 1,
      hybride: 1,
    },
    by_month: {
      "2026-01": 2,
      "2026-02": 3,
    },
  },
  trainings: [mockTraining],
  missing_elements: {
    without_evaluations: [],
    without_certificates: [],
    without_attendance: [],
  },
};

// Email template fixtures
export const mockEmailTemplates = [
  {
    id: "template-1",
    organization_id: "org-123",
    template_type: "needs_survey" as const,
    name: "Questionnaire de besoins",
    subject: "Préparation de votre formation {{training_name}}",
    body_html: "<p>Bonjour {{participant_first_name}},</p>",
    variables: ["participant_first_name", "training_name", "survey_link"],
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "template-2",
    organization_id: "org-123",
    template_type: "thank_you" as const,
    name: "Remerciement post-formation",
    subject: "Merci pour votre participation à {{training_name}}",
    body_html: "<p>Bonjour {{participant_first_name}},</p>",
    variables: ["participant_first_name", "training_name", "evaluation_link"],
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// Integrations fixtures
export const mockIntegrations = {
  id: "int-1",
  organization_id: "org-123",
  pdf_provider: "internal" as const,
  pdfmonkey_api_key: null,
  pdfmonkey_template_id: null,
  google_drive_enabled: false,
  google_drive_client_id: null,
  google_drive_client_secret: null,
  google_drive_refresh_token: null,
  google_drive_folder_id: null,
  resend_api_key: "re_test_123",
  resend_from_email: "test@example.com",
  resend_from_name: "Test Organisation",
  signitic_enabled: false,
  signitic_api_key: null,
  signitic_user_email: null,
  gemini_enabled: false,
  gemini_api_key: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
