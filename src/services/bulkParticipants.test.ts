import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ───────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
    })),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("@/lib/emailScheduling", () => ({
  getEmailMode: vi.fn(() => ({ status: "accueil_envoye", sendWelcomeNow: true })),
}));

vi.mock("@/lib/stringUtils", () => ({
  capitalizeName: vi.fn((s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null),
}));

vi.mock("@/lib/workingDays", () => ({
  fetchWorkingDays: vi.fn(),
  fetchNeedsSurveyDelay: vi.fn(),
  subtractWorkingDays: vi.fn(),
  scheduleTrainerSummaryIfNeeded: vi.fn(),
}));

const {
  insertParticipantsWithQuestionnaires,
  sendWelcomeEmailsToBatch,
  sendElearningAccessToBatch,
  logBulkAddActivity,
  buildStatusMessage,
} = await import("./bulkParticipants");

beforeEach(() => {
  vi.clearAllMocks();
  // Default: insert returns data
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      data: [
        {
          id: "p1",
          email: "alice@test.com",
          first_name: "Alice",
          last_name: "Dupont",
          company: null,
          needs_survey_token: "token-1",
          sponsor_email: null,
        },
      ],
      error: null,
    }),
  });
});

describe("insertParticipantsWithQuestionnaires", () => {
  const participants = [
    { email: "alice@test.com", firstName: "alice", lastName: "dupont" },
  ];

  it("inserts participants and creates questionnaire records", async () => {
    mockInsert.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        data: [
          {
            id: "p1",
            email: "alice@test.com",
            first_name: "Alice",
            last_name: "Dupont",
            company: null,
            needs_survey_token: "token-1",
            sponsor_email: null,
          },
        ],
        error: null,
      }),
    });
    // Second insert call for questionnaire_besoins
    mockInsert.mockReturnValueOnce({ data: null, error: null });

    const result = await insertParticipantsWithQuestionnaires(participants, "t1", "2026-06-01");
    expect(result.data).toHaveLength(1);
    expect(result.sendWelcomeNow).toBe(true);
    expect(result.duplicateWarning).toBe(false);
  });

  it("sets duplicateWarning=true on duplicate key error (23505)", async () => {
    mockInsert.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    });

    const result = await insertParticipantsWithQuestionnaires(participants, "t1", "2026-06-01");
    expect(result.duplicateWarning).toBe(true);
    expect(result.data).toBeNull();
  });

  it("throws on non-duplicate supabase error", async () => {
    mockInsert.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        data: null,
        error: { code: "42000", message: "Some DB error" },
      }),
    });

    await expect(
      insertParticipantsWithQuestionnaires(participants, "t1", "2026-06-01"),
    ).rejects.toThrow();
  });
});

describe("sendWelcomeEmailsToBatch", () => {
  const batch = [
    { id: "p1", email: "alice@test.com", first_name: "Alice", last_name: "D", company: null, needs_survey_token: "t", sponsor_email: null },
  ];

  it("invokes send-welcome-email for each participant", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await sendWelcomeEmailsToBatch(batch, "t1");
    expect(mockInvoke).toHaveBeenCalledWith("send-welcome-email", {
      body: { participantId: "p1", trainingId: "t1" },
    });
  });

  it("does not throw when invocation fails for a participant", async () => {
    mockInvoke.mockRejectedValue(new Error("network error"));
    await expect(sendWelcomeEmailsToBatch(batch, "t1")).resolves.toBeUndefined();
  });
});

describe("sendElearningAccessToBatch", () => {
  const batch = [
    { id: "p1", email: "a@b.com", first_name: null, last_name: null, company: null, needs_survey_token: "t", sponsor_email: null },
  ];

  it("generates coupon then sends e-learning access email", async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: { coupon_code: "COUPON-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await sendElearningAccessToBatch(batch, "t1");
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, "generate-woocommerce-coupon", {
      body: { participantId: "p1", trainingId: "t1" },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "send-elearning-access", {
      body: { participantId: "p1", trainingId: "t1", couponCode: "COUPON-1" },
    });
  });

  it("sends e-learning access even when coupon generation fails", async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error("coupon fail"))
      .mockResolvedValueOnce({ data: null, error: null });

    await sendElearningAccessToBatch(batch, "t1");
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "send-elearning-access", {
      body: { participantId: "p1", trainingId: "t1", couponCode: undefined },
    });
  });
});

describe("logBulkAddActivity", () => {
  const participants = [
    { id: "p1", email: "a@b.com", first_name: "A", last_name: "B", company: "Corp", needs_survey_token: "t", sponsor_email: "s@b.com" },
  ];

  it("inserts activity logs with correct details", async () => {
    mockInsert.mockReturnValue({ data: null, error: null });
    await logBulkAddActivity(participants, "t1", true);
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        action_type: "participant_added",
        recipient_email: "a@b.com",
        details: expect.objectContaining({
          training_id: "t1",
          bulk_add: true,
          has_sponsor: true,
        }),
      }),
    ]);
  });

  it("sets has_sponsor false when not inter-entreprise", async () => {
    mockInsert.mockReturnValue({ data: null, error: null });
    await logBulkAddActivity(participants, "t1", false);
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        details: expect.objectContaining({ has_sponsor: false }),
      }),
    ]);
  });
});

describe("buildStatusMessage", () => {
  it("returns past training message for 'non_envoye'", () => {
    expect(buildStatusMessage("non_envoye", false, false)).toBe(
      "Formation pass\u00e9e \u2014 aucun email programm\u00e9.",
    );
  });

  it("returns manual mode message for 'manuel'", () => {
    expect(buildStatusMessage("manuel", false, false)).toBe(
      "Mode manuel activ\u00e9 (formation proche).",
    );
  });

  it("returns welcome + needs survey scheduled message", () => {
    expect(buildStatusMessage("accueil_envoye", true, false)).toBe(
      "Mails d'accueil envoy\u00e9s, recueil des besoins programm\u00e9.",
    );
  });

  it("returns welcome + needs survey skipped warning", () => {
    const msg = buildStatusMessage("accueil_envoye", true, true);
    expect(msg).toContain("Mails d'accueil envoy\u00e9s");
    expect(msg).toContain("recueil des besoins n'a pas \u00e9t\u00e9 programm\u00e9");
  });

  it("returns needs survey scheduled as default", () => {
    expect(buildStatusMessage("programme", false, false)).toBe(
      "Recueil des besoins programm\u00e9.",
    );
  });

  it("returns needs survey skipped warning when only that is skipped", () => {
    const msg = buildStatusMessage("programme", false, true);
    expect(msg).toContain("recueil des besoins n'a pas \u00e9t\u00e9 programm\u00e9");
  });
});
