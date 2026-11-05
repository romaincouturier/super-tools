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
  enqueueElearningAccessBatch,
  logBulkAddActivity,
  buildStatusMessage,
  formulaColumns,
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
  const noExisting = () => mockSelect.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) });
  const row = (id: string, email: string) => ({ id, email, first_name: null, last_name: null, company: null, needs_survey_token: id, sponsor_email: null });

  it("inserts participants and creates questionnaire records", async () => {
    noExisting();
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: [row("p1", "alice@test.com")], error: null }) });
    mockInsert.mockReturnValueOnce({ data: null, error: null });

    const result = await insertParticipantsWithQuestionnaires(participants, "t1", "2026-06-01");
    expect(result.data).toHaveLength(1);
    expect(result.sendWelcomeNow).toBe(true);
    expect(result.duplicateWarning).toBe(false);
  });

  it("un email en double dans la liste n'empêche pas d'ajouter les autres", async () => {
    noExisting();
    const list = [
      { email: "a@test.com" }, { email: "A@test.com " }, { email: "b@test.com" },
    ];
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: [row("p1", "a@test.com"), row("p2", "b@test.com")], error: null }) });
    mockInsert.mockReturnValueOnce({ data: null, error: null });

    const result = await insertParticipantsWithQuestionnaires(list as never, "t1", "2026-06-01");
    expect(mockInsert.mock.calls[0][0]).toHaveLength(2);
    expect(result.data).toHaveLength(2);
    expect(result.duplicateWarning).toBe(true);
  });

  it("un participant déjà inscrit est ignoré, les autres sont ajoutés", async () => {
    mockSelect.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ data: [{ email: "a@test.com" }], error: null }) });
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: [row("p2", "b@test.com")], error: null }) });
    mockInsert.mockReturnValueOnce({ data: null, error: null });

    const result = await insertParticipantsWithQuestionnaires([{ email: "a@test.com" }, { email: "b@test.com" }] as never, "t1", "2026-06-01");
    expect(result.data).toHaveLength(1);
    expect(result.duplicateWarning).toBe(true);
  });

  it("sets duplicateWarning=true on duplicate key error (23505) and keeps others", async () => {
    noExisting();
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: null, error: { code: "23505", message: "duplicate" } }) });
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: null, error: { code: "23505", message: "duplicate" } }) });
    mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ data: [row("p2", "b@test.com")], error: null }) });
    mockInsert.mockReturnValueOnce({ data: null, error: null });

    const result = await insertParticipantsWithQuestionnaires([{ email: "a@test.com" }, { email: "b@test.com" }] as never, "t1", "2026-06-01");
    expect(result.duplicateWarning).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("throws on non-duplicate supabase error", async () => {
    noExisting();
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

describe("enqueueElearningAccessBatch", () => {
  const batch = [
    { id: "p1", email: "a@b.com", first_name: null, last_name: null, company: null, needs_survey_token: "t", sponsor_email: null },
    { id: "p2", email: "c@d.com", first_name: null, last_name: null, company: null, needs_survey_token: "t", sponsor_email: null },
  ];

  it("confie tout le lot au serveur en un seul appel", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true, batchId: "b1", total: 2 }, error: null });
    await expect(enqueueElearningAccessBatch(batch, "t1")).resolves.toEqual({ batchId: "b1", total: 2 });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("queue-learner-access-emails", {
      body: { action: "enqueue", trainingId: "t1", emails: ["a@b.com", "c@d.com"] },
    });
  });

  it("signale un échec de programmation", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Forbidden") });
    await expect(enqueueElearningAccessBatch(batch, "t1")).rejects.toThrow("Forbidden");
  });
});

describe("progression des envois d'accueil en lot", () => {
  const batch = [
    { id: "p1", email: "a@example.com", first_name: null, last_name: null, company: null, needs_survey_token: "t1", sponsor_email: null },
    { id: "p2", email: "b@example.com", first_name: null, last_name: null, company: null, needs_survey_token: "t2", sponsor_email: null },
  ];

  it("compte chaque participant traité, même après un échec", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("network error"));
    mockInvoke.mockResolvedValueOnce({ data: null, error: null });
    const updates: number[][] = [];
    await sendWelcomeEmailsToBatch(batch, "t1", (completed, total) => updates.push([completed, total]));
    expect(updates).toEqual([[1, 2], [2, 2]]);
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

describe("formulaColumns", () => {
  it("n'ajoute rien sans formule", () => {
    expect(formulaColumns(null)).toEqual({});
  });
  it("renseigne la formule sans coaching", () => {
    expect(formulaColumns({ id: "f1", name: "Solo", coaching_sessions_count: 0 })).toEqual({ formula: "Solo", formula_id: "f1" });
  });
  it("ouvre le coaching sur un an si la formule en inclut", () => {
    expect(formulaColumns({ id: "f2", name: "Coachée", coaching_sessions_count: 3 }, new Date("2026-11-05T10:00:00Z"))).toEqual({
      formula: "Coachée", formula_id: "f2", coaching_sessions_total: 3, coaching_sessions_completed: 0, coaching_deadline: "2027-11-05",
    });
  });
});
