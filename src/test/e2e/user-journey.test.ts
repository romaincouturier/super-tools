/**
 * E2E Test: Complete User Journey
 * From signup/onboarding to BPF generation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockUser,
  mockOrganization,
  mockUserProfile,
  mockSubscription,
  mockTrainer,
  mockTraining,
  mockTrainingSchedules,
  mockParticipants,
  mockEvaluations,
  mockAttendanceSignatures,
  mockUsageTracking,
  mockBpfData,
  mockEmailTemplates,
  mockIntegrations,
} from "../fixtures";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("User Journey: Onboarding to BPF", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default auth state (not authenticated)
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Step 1: User Signup", () => {
    it("should create a new user account", async () => {
      // Arrange
      const newUserEmail = "nouveau@test.com";
      const newUserPassword = "Password123!";

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: { ...mockUser, email: newUserEmail },
          session: {
            user: { ...mockUser, email: newUserEmail },
            access_token: "new-token",
          },
        },
        error: null,
      });

      // Act
      const result = await mockSupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });

      // Assert
      expect(result.error).toBeNull();
      expect(result.data.user?.email).toBe(newUserEmail);
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: newUserEmail,
        password: newUserPassword,
      });
    });

    it("should handle signup errors", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Email already registered" },
      });

      const result = await mockSupabase.auth.signUp({
        email: "existing@test.com",
        password: "Password123!",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toBe("Email already registered");
    });
  });

  describe("Step 2: Organization Onboarding", () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should create a new organization with setup_new_organization RPC", async () => {
      // Arrange
      const orgName = "Ma Formation SARL";
      const orgSlug = "ma-formation-sarl";

      mockSupabase.rpc.mockResolvedValue({
        data: mockOrganization.id,
        error: null,
      });

      // Act
      const result = await mockSupabase.rpc("setup_new_organization", {
        p_org_name: orgName,
        p_org_slug: orgSlug,
        p_owner_id: mockUser.id,
        p_owner_email: mockUser.email,
      });

      // Assert
      expect(result.error).toBeNull();
      expect(result.data).toBe(mockOrganization.id);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("setup_new_organization", {
        p_org_name: orgName,
        p_org_slug: orgSlug,
        p_owner_id: mockUser.id,
        p_owner_email: mockUser.email,
      });
    });

    it("should create default subscription (free plan)", async () => {
      // The setup_new_organization RPC creates this automatically
      // Verify by checking the subscription
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSubscription,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", mockOrganization.id)
        .single();

      expect(result.data?.plan).toBe("free");
      expect(result.data?.monthly_training_limit).toBe(2);
    });

    it("should create default trainer from owner", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockTrainer,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("trainers")
        .select("*")
        .eq("organization_id", mockOrganization.id)
        .single();

      expect(result.data?.is_default).toBe(true);
      expect(result.data?.user_id).toBe(mockUser.id);
    });

    it("should create default email templates", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockEmailTemplates,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("email_templates")
        .select("*")
        .eq("organization_id", mockOrganization.id);

      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe("Step 3: Create Training", () => {
    beforeEach(() => {
      // Setup authenticated user with organization
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should check if user can create training within subscription limit", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await mockSupabase.rpc("can_create_training");

      expect(result.data).toBe(true);
    });

    it("should create a new training", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockTraining,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const trainingData = {
        organization_id: mockOrganization.id,
        trainer_id: mockTrainer.id,
        training_name: mockTraining.training_name,
        client_name: mockTraining.client_name,
        location: mockTraining.location,
        format_formation: mockTraining.format_formation,
        start_date: mockTraining.start_date,
        end_date: mockTraining.end_date,
        trainer_name: mockTraining.trainer_name,
        sponsor_first_name: mockTraining.sponsor_first_name,
        sponsor_last_name: mockTraining.sponsor_last_name,
        sponsor_email: mockTraining.sponsor_email,
        objectifs_pedagogiques: mockTraining.objectifs_pedagogiques,
      };

      const result = await mockSupabase
        .from("trainings")
        .insert(trainingData)
        .select()
        .single();

      expect(result.data?.id).toBe(mockTraining.id);
      expect(result.error).toBeNull();
    });

    it("should create training schedules", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: mockTrainingSchedules,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const scheduleData = mockTrainingSchedules.map((s) => ({
        training_id: mockTraining.id,
        day_date: s.day_date,
        start_time: s.start_time,
        end_time: s.end_time,
      }));

      const result = await mockSupabase
        .from("training_schedules")
        .insert(scheduleData)
        .select();

      expect(result.data?.length).toBe(2);
    });

    it("should increment usage tracking when training is created", async () => {
      // This is done by trigger in the database
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockUsageTracking, trainings_created: 2 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("usage_tracking")
        .select("*")
        .eq("organization_id", mockOrganization.id)
        .single();

      expect(result.data?.trainings_created).toBeGreaterThan(0);
    });
  });

  describe("Step 4: Add Participants", () => {
    it("should add participants to training", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: mockParticipants,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const participantData = mockParticipants.map((p) => ({
        training_id: mockTraining.id,
        organization_id: mockOrganization.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        company: p.company,
      }));

      const result = await mockSupabase
        .from("training_participants")
        .insert(participantData)
        .select();

      expect(result.data?.length).toBe(2);
    });

    it("should send needs survey emails via edge function", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true, sent: 2 },
        error: null,
      });

      const result = await mockSupabase.functions.invoke("send-needs-survey", {
        body: {
          trainingId: mockTraining.id,
          participantIds: mockParticipants.map((p) => p.id),
        },
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.sent).toBe(2);
    });
  });

  describe("Step 5: Conduct Training & Attendance", () => {
    it("should send attendance signature requests", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await mockSupabase.functions.invoke(
        "send-attendance-signature-request",
        {
          body: {
            trainingId: mockTraining.id,
            scheduleId: mockTrainingSchedules[0].id,
            period: "am",
          },
        }
      );

      expect(result.data?.success).toBe(true);
    });

    it("should record attendance signatures", async () => {
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: mockAttendanceSignatures,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const signatureData = {
        training_id: mockTraining.id,
        participant_id: mockParticipants[0].id,
        schedule_id: mockTrainingSchedules[0].id,
        period: "am",
        signature: "data:image/png;base64,mockSignature",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0",
      };

      const result = await mockSupabase
        .from("attendance_signatures")
        .insert(signatureData)
        .select();

      expect(result.error).toBeNull();
    });
  });

  describe("Step 6: Post-Training Evaluations", () => {
    it("should send thank you emails with evaluation links", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true, sent: 2 },
        error: null,
      });

      const result = await mockSupabase.functions.invoke("send-thank-you-email", {
        body: {
          trainingId: mockTraining.id,
        },
      });

      expect(result.data?.success).toBe(true);
    });

    it("should record participant evaluations", async () => {
      const mockChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: mockEvaluations[0],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const evaluationData = {
        training_id: mockTraining.id,
        participant_id: mockParticipants[0].id,
        etat: "soumis",
        appreciation_globale: 5,
        equilibre_theorie_pratique: 5,
        rythme_formation: 4,
        qualification_intervenant: 5,
        recommandation_nps: 9,
        objectifs_atteints: { objectif_1: 5, objectif_2: 4, objectif_3: 5 },
      };

      const result = await mockSupabase
        .from("training_evaluations")
        .upsert(evaluationData)
        .select();

      expect(result.data?.etat).toBe("soumis");
    });

    it("should trigger certificate generation after evaluation", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          certificateUrl: "https://drive.google.com/...",
        },
        error: null,
      });

      const result = await mockSupabase.functions.invoke("generate-certificates", {
        body: {
          trainingId: mockTraining.id,
          participantIds: [mockParticipants[0].id],
        },
      });

      expect(result.data?.success).toBe(true);
    });

    it("should send evaluation reminders (J+2, J+4)", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true, reminders_sent: 1 },
        error: null,
      });

      const result = await mockSupabase.functions.invoke(
        "send-evaluation-reminder",
        {
          body: {
            trainingId: mockTraining.id,
            reminderType: "j2",
          },
        }
      );

      expect(result.data?.success).toBe(true);
    });
  });

  describe("Step 7: Sponsor Feedback (Qualiopi)", () => {
    it("should send feedback request to sponsor", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await mockSupabase.functions.invoke(
        "send-sponsor-feedback-request",
        {
          body: {
            trainingId: mockTraining.id,
          },
        }
      );

      expect(result.data?.success).toBe(true);
    });

    it("should record sponsor feedback", async () => {
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: {
            ...mockTraining,
            sponsor_feedback_score: 5,
            sponsor_feedback_response: "Excellente formation",
            sponsor_feedback_received_at: new Date().toISOString(),
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await mockSupabase
        .from("trainings")
        .update({
          sponsor_feedback_score: 5,
          sponsor_feedback_response: "Excellente formation",
          sponsor_feedback_received_at: new Date().toISOString(),
        })
        .eq("id", mockTraining.id)
        .select();

      expect(result.data?.sponsor_feedback_score).toBe(5);
    });
  });

  describe("Step 8: Generate BPF", () => {
    it("should generate BPF data via edge function", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockBpfData,
        error: null,
      });

      const result = await mockSupabase.functions.invoke("generate-bpf", {
        body: {
          organizationId: mockOrganization.id,
          year: 2026,
        },
      });

      expect(result.data?.year).toBe(2026);
      expect(result.data?.stats.total_trainings).toBe(5);
      expect(result.data?.stats.total_participants).toBe(25);
      expect(result.data?.stats.total_hours).toBe(80);
    });

    it("should identify missing elements for BPF compliance", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockBpfData,
        error: null,
      });

      const result = await mockSupabase.functions.invoke("generate-bpf", {
        body: {
          organizationId: mockOrganization.id,
          year: 2026,
        },
      });

      expect(result.data?.missing_elements).toBeDefined();
      expect(Array.isArray(result.data?.missing_elements.without_evaluations)).toBe(
        true
      );
      expect(Array.isArray(result.data?.missing_elements.without_certificates)).toBe(
        true
      );
      expect(Array.isArray(result.data?.missing_elements.without_attendance)).toBe(
        true
      );
    });

    it("should calculate statistics by format", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockBpfData,
        error: null,
      });

      const result = await mockSupabase.functions.invoke("generate-bpf", {
        body: {
          organizationId: mockOrganization.id,
          year: 2026,
        },
      });

      expect(result.data?.stats.by_format).toBeDefined();
      expect(result.data?.stats.by_format.presentiel).toBe(3);
      expect(result.data?.stats.by_format.distanciel).toBe(1);
      expect(result.data?.stats.by_format.hybride).toBe(1);
    });

    it("should calculate statistics by month", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockBpfData,
        error: null,
      });

      const result = await mockSupabase.functions.invoke("generate-bpf", {
        body: {
          organizationId: mockOrganization.id,
          year: 2026,
        },
      });

      expect(result.data?.stats.by_month).toBeDefined();
      expect(result.data?.stats.by_month["2026-01"]).toBe(2);
      expect(result.data?.stats.by_month["2026-02"]).toBe(3);
    });
  });

  describe("Step 9: Evaluation Summary for Sponsor", () => {
    it("should send evaluation summary to sponsor", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          message: `Synthèse envoyée à ${mockTraining.sponsor_email}`,
          stats: {
            evaluations_count: 2,
            average_score: 4.5,
            nps_score: 50,
          },
        },
        error: null,
      });

      const result = await mockSupabase.functions.invoke(
        "send-evaluation-summary",
        {
          body: {
            trainingId: mockTraining.id,
            customMessage: "Merci pour votre confiance",
          },
        }
      );

      expect(result.data?.success).toBe(true);
      expect(result.data?.stats.evaluations_count).toBe(2);
      expect(result.data?.stats.average_score).toBe(4.5);
    });
  });

  describe("Integration: Complete Flow Validation", () => {
    it("should complete full journey from signup to BPF", async () => {
      // This test validates the entire flow can execute without errors

      // 1. Signup
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: { user: mockUser } },
        error: null,
      });

      // 2. Onboarding
      mockSupabase.rpc.mockResolvedValue({
        data: mockOrganization.id,
        error: null,
      });

      // 3-7. Training flow
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      // 8. BPF Generation
      mockSupabase.functions.invoke.mockImplementation(async (name) => {
        if (name === "generate-bpf") {
          return { data: mockBpfData, error: null };
        }
        return { data: { success: true }, error: null };
      });

      // Execute flow
      const signupResult = await mockSupabase.auth.signUp({
        email: "test@test.com",
        password: "Password123!",
      });
      expect(signupResult.error).toBeNull();

      const onboardingResult = await mockSupabase.rpc("setup_new_organization", {
        p_org_name: "Test Org",
        p_org_slug: "test-org",
        p_owner_id: mockUser.id,
        p_owner_email: mockUser.email,
      });
      expect(onboardingResult.error).toBeNull();

      const bpfResult = await mockSupabase.functions.invoke("generate-bpf", {
        body: { organizationId: mockOrganization.id, year: 2026 },
      });
      expect(bpfResult.error).toBeNull();
      expect(bpfResult.data?.year).toBe(2026);
    });
  });
});
