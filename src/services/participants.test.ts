import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (vi.mock is hoisted, so variables must be too) ────────────
const {
  mockSingle,
  mockSelect,
  mockInsert,
  mockFrom,
  mockInvoke,
  mockStorageFrom,
  mockStorageBucket,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn((..._args: unknown[]) => ({ single: mockSingle }));
  const mockInsert = vi.fn((..._args: unknown[]) => ({ select: mockSelect }));
  const mockFrom = vi.fn((..._args: unknown[]) => ({
    select: vi.fn().mockReturnThis(),
    insert: mockInsert,
    update: vi.fn(() => ({ eq: vi.fn() })),
    delete: vi.fn(() => ({ eq: vi.fn() })),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: mockSingle,
    maybeSingle: vi.fn(),
  }));
  const mockInvoke = vi.fn();
  const mockStorageBucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/file.pdf" } })),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockStorageFrom = vi.fn().mockReturnValue(mockStorageBucket);
  return { mockSingle, mockSelect, mockInsert, mockFrom, mockInvoke, mockStorageFrom, mockStorageBucket };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: mockInvoke },
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("@/lib/workingDays", () => ({
  fetchWorkingDays: vi.fn().mockResolvedValue([]),
  fetchNeedsSurveyDelay: vi.fn().mockResolvedValue(10),
  subtractWorkingDays: vi.fn(() => new Date("2099-01-01")),
  scheduleTrainerSummaryIfNeeded: vi.fn(),
}));

vi.mock("@/services/activityLog", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  scheduleEmail: vi.fn().mockResolvedValue(undefined),
}));

import {
  sanitizeUploadName,
  capitalizeOrEmpty,
  createParticipant,
  uploadParticipantFile,
  deleteParticipantFile,
  uploadSignedConvention,
  deleteSignedConvention,
  sendLearnerMagicLink,
  catchUpAttendanceSignaturesForParticipant,
  type CreateParticipantInput,
  type ParticipantFile,
} from "./participants";

// ── Pure function tests ─────────────────────────────────────────────────────

describe("sanitizeUploadName", () => {
  it("removes accents from French characters", () => {
    expect(sanitizeUploadName("résumé.pdf")).toBe("resume.pdf");
  });

  it("replaces parentheses and spaces with underscores", () => {
    expect(sanitizeUploadName("fichier (1).pdf")).toBe("fichier__1_.pdf");
  });

  it("handles multiple accented characters", () => {
    expect(sanitizeUploadName("café_crème.doc")).toBe("cafe_creme.doc");
  });

  it("preserves already valid filenames", () => {
    expect(sanitizeUploadName("normal-file.txt")).toBe("normal-file.txt");
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeUploadName("file with spaces.pdf")).toBe("file_with_spaces.pdf");
  });

  it("handles a complex French string with accents and spaces", () => {
    expect(sanitizeUploadName("éclair à la crème.pdf")).toBe("eclair_a_la_creme.pdf");
  });
});

describe("capitalizeOrEmpty", () => {
  it("capitalizes a simple name", () => {
    expect(capitalizeOrEmpty("jean")).toBe("Jean");
  });

  it("returns empty string for empty input", () => {
    expect(capitalizeOrEmpty("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(capitalizeOrEmpty("   ")).toBe("");
  });

  it("capitalizes compound names", () => {
    expect(capitalizeOrEmpty("jean-pierre")).toBe("Jean-Pierre");
  });
});

// ── createParticipant tests ─────────────────────────────────────────────────

describe("createParticipant", () => {
  const baseInput: CreateParticipantInput = {
    trainingId: "training-1",
    firstName: "jean",
    lastName: "dupont",
    email: "  Jean.Dupont@Example.COM  ",
    company: " Acme Corp ",
    token: "tok-123",
    status: "non_envoye",
    formulaId: "formula-1",
    formulaName: "Standard",
    coachingTotal: 3,
    coachingDeadline: "2025-06-01",
    isInterEntreprise: false,
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    financeurSameAsSponsor: false,
    financeurName: "",
    financeurUrl: "",
    paymentMode: "online",
    soldPriceHt: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: "participant-1" },
      error: null,
    });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  const getInsertPayload = () => {
    const payload = mockInsert.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    return payload as Record<string, unknown>;
  };

  it("normalizes email to lowercase and trimmed", async () => {
    await createParticipant(baseInput);

    const insertCall = getInsertPayload();
    expect(insertCall.email).toBe("jean.dupont@example.com");
  });

  it("trims the company name", async () => {
    await createParticipant(baseInput);

    const insertCall = getInsertPayload();
    expect(insertCall.company).toBe("Acme Corp");
  });

  it("capitalizes first_name and last_name", async () => {
    await createParticipant(baseInput);

    const insertCall = getInsertPayload();
    expect(insertCall.first_name).toBe("Jean");
    expect(insertCall.last_name).toBe("Dupont");
  });

  it("includes formula fields when formulaId is provided", async () => {
    await createParticipant(baseInput);

    const insertCall = getInsertPayload();
    expect(insertCall.formula).toBe("Standard");
    expect(insertCall.formula_id).toBe("formula-1");
  });

  it("excludes formula fields when formulaId is empty", async () => {
    await createParticipant({ ...baseInput, formulaId: "", formulaName: "" });

    const insertCall = getInsertPayload();
    expect(insertCall.formula).toBeUndefined();
    expect(insertCall.formula_id).toBeUndefined();
  });

  it("excludes sponsor/financeur fields for intra-entreprise", async () => {
    await createParticipant({ ...baseInput, isInterEntreprise: false });

    const insertCall = getInsertPayload();
    expect(insertCall.sponsor_first_name).toBeUndefined();
    expect(insertCall.sponsor_last_name).toBeUndefined();
    expect(insertCall.sponsor_email).toBeUndefined();
    expect(insertCall.financeur_same_as_sponsor).toBeUndefined();
    expect(insertCall.payment_mode).toBeUndefined();
  });

  it("includes sponsor fields for inter-entreprise", async () => {
    const interInput: CreateParticipantInput = {
      ...baseInput,
      isInterEntreprise: true,
      sponsorFirstName: "marie",
      sponsorLastName: "martin",
      sponsorEmail: "  Marie@SPONSOR.com  ",
      financeurSameAsSponsor: false,
      financeurName: " OPCO Atlas ",
      financeurUrl: " https://opco.fr ",
      paymentMode: "invoice",
      soldPriceHt: "1500.50",
    };

    await createParticipant(interInput);

    const insertCall = getInsertPayload();
    expect(insertCall.sponsor_first_name).toBe("Marie");
    expect(insertCall.sponsor_last_name).toBe("Martin");
    expect(insertCall.sponsor_email).toBe("marie@sponsor.com");
    expect(insertCall.financeur_same_as_sponsor).toBe(false);
    expect(insertCall.financeur_name).toBe("OPCO Atlas");
    expect(insertCall.financeur_url).toBe("https://opco.fr");
    expect(insertCall.payment_mode).toBe("invoice");
    expect(insertCall.sold_price_ht).toBe(1500.50);
  });

  it("nullifies financeur fields when financeurSameAsSponsor is true", async () => {
    const interInput: CreateParticipantInput = {
      ...baseInput,
      isInterEntreprise: true,
      sponsorFirstName: "marie",
      sponsorLastName: "martin",
      sponsorEmail: "marie@sponsor.com",
      financeurSameAsSponsor: true,
      financeurName: "Should be ignored",
      financeurUrl: "https://ignored.com",
      paymentMode: "online",
      soldPriceHt: "2000",
    };

    await createParticipant(interInput);

    const insertCall = getInsertPayload();
    expect(insertCall.financeur_same_as_sponsor).toBe(true);
    expect(insertCall.financeur_name).toBeNull();
    expect(insertCall.financeur_url).toBeNull();
  });

  it("throws when supabase insert returns an error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Insert failed" },
    });

    await expect(createParticipant(baseInput)).rejects.toEqual({
      message: "Insert failed",
    });
  });

  it("creates questionnaire_besoins record after successful insert", async () => {
    await createParticipant(baseInput);

    expect(mockFrom).toHaveBeenCalledWith("training_participants");
    expect(mockFrom).toHaveBeenCalledWith("questionnaire_besoins");
  });
});

// ── uploadParticipantFile tests ─────────────────────────────────────────────

describe("uploadParticipantFile", () => {
  const file = new File(["content"], "test.pdf", { type: "application/pdf" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the upload-participant-file edge function (not direct storage)", async () => {
    mockInvoke.mockResolvedValue({
      data: { file: { id: "f1", file_url: "https://example.com/file.pdf", file_name: "test.pdf", uploaded_at: "2024-01-01" } },
      error: null,
    });

    await uploadParticipantFile("training-1", "participant-1", file);

    expect(mockInvoke).toHaveBeenCalledWith("upload-participant-file", expect.objectContaining({ body: expect.any(FormData) }));
    // Must NOT call direct storage — RLS bypass is the whole point
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("passes trainingId and participantId in the FormData body", async () => {
    mockInvoke.mockResolvedValue({
      data: { file: { id: "f1", file_url: "https://example.com/file.pdf", file_name: "test.pdf", uploaded_at: "2024-01-01" } },
      error: null,
    });

    await uploadParticipantFile("training-abc", "participant-xyz", file);

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: FormData }];
    expect(fnName).toBe("upload-participant-file");
    expect(options.body.get("trainingId")).toBe("training-abc");
    expect(options.body.get("participantId")).toBe("participant-xyz");
    expect(options.body.get("file")).toBe(file);
  });

  it("returns the file record from the edge function response", async () => {
    const expected: ParticipantFile = {
      id: "f1",
      file_url: "https://example.com/file.pdf",
      file_name: "test.pdf",
      uploaded_at: "2024-01-01T00:00:00Z",
    };
    mockInvoke.mockResolvedValue({ data: { file: expected }, error: null });

    const result = await uploadParticipantFile("training-1", "participant-1", file);
    expect(result).toEqual(expected);
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("RLS violation") });

    await expect(uploadParticipantFile("training-1", "participant-1", file)).rejects.toThrow("RLS violation");
  });

  it("throws when the edge function returns no file data", async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expect(uploadParticipantFile("training-1", "participant-1", file)).rejects.toThrow();
  });
});

// ── deleteParticipantFile tests ─────────────────────────────────────────────

describe("deleteParticipantFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageBucket.remove.mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: mockInsert,
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: mockDelete,
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: mockSingle,
      maybeSingle: vi.fn(),
    });
  });

  it("removes from participant-files bucket for new-style URLs", async () => {
    const fileRecord: ParticipantFile = {
      id: "f1",
      file_url: "https://project.supabase.co/storage/v1/object/public/participant-files/training-1/abc_test.pdf",
      file_name: "test.pdf",
      uploaded_at: "2024-01-01",
    };

    await deleteParticipantFile(fileRecord);

    expect(mockStorageFrom).toHaveBeenCalledWith("participant-files");
    expect(mockStorageBucket.remove).toHaveBeenCalledWith(["training-1/abc_test.pdf"]);
  });

  it("removes from training-documents bucket for legacy URLs", async () => {
    const fileRecord: ParticipantFile = {
      id: "f2",
      file_url: "https://project.supabase.co/storage/v1/object/public/training-documents/training-1/legacy.pdf",
      file_name: "legacy.pdf",
      uploaded_at: "2024-01-01",
    };

    await deleteParticipantFile(fileRecord);

    expect(mockStorageFrom).toHaveBeenCalledWith("training-documents");
    expect(mockStorageBucket.remove).toHaveBeenCalledWith(["training-1/legacy.pdf"]);
  });

  it("always deletes the participant_files DB record", async () => {
    const fileRecord: ParticipantFile = {
      id: "f1",
      file_url: "https://project.supabase.co/storage/v1/object/public/participant-files/path/file.pdf",
      file_name: "file.pdf",
      uploaded_at: "2024-01-01",
    };

    await deleteParticipantFile(fileRecord);

    expect(mockFrom).toHaveBeenCalledWith("participant_files");
  });
});

// ── sendLearnerMagicLink tests ──────────────────────────────────────────────

describe("sendLearnerMagicLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes the send-learner-magic-link edge function with email", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendLearnerMagicLink("alice@example.com");

    expect(mockInvoke).toHaveBeenCalledWith(
      "send-learner-magic-link",
      expect.objectContaining({ body: expect.objectContaining({ email: "alice@example.com" }) }),
    );
  });

  it("passes optional trainingId and participantId when provided", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendLearnerMagicLink("alice@example.com", "training-abc", "participant-xyz");

    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.trainingId).toBe("training-abc");
    expect(options.body.participantId).toBe("participant-xyz");
  });

  it("omits trainingId and participantId when not provided", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendLearnerMagicLink("alice@example.com");

    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.trainingId).toBeUndefined();
    expect(options.body.participantId).toBeUndefined();
  });
});

// ── catchUpAttendanceSignaturesForParticipant tests ─────────────────────────

describe("catchUpAttendanceSignaturesForParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: {}, error: null });
  });

  const makeSentRows = (rows: { schedule_date: string; period: string }[]) =>
    vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    });

  it("returns { sentSlots: 0, errors: 0 } when no slots have been sent yet", async () => {
    mockFrom.mockImplementationOnce(makeSentRows([]));

    const result = await catchUpAttendanceSignaturesForParticipant("training-1", "participant-1");

    expect(result).toEqual({ sentSlots: 0, errors: 0 });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invokes send-attendance-signature-request once per unique slot", async () => {
    // Two rows for the same slot (duplicate) + one different slot
    mockFrom.mockImplementationOnce(makeSentRows([
      { schedule_date: "2024-03-01", period: "morning" },
      { schedule_date: "2024-03-01", period: "morning" }, // duplicate
      { schedule_date: "2024-03-02", period: "afternoon" },
    ]));

    const result = await catchUpAttendanceSignaturesForParticipant("training-1", "participant-1");

    expect(result.sentSlots).toBe(2);
    expect(result.errors).toBe(0);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("passes participantIds filter so only the new participant is emailed", async () => {
    mockFrom.mockImplementationOnce(makeSentRows([
      { schedule_date: "2024-03-01", period: "morning" },
    ]));

    await catchUpAttendanceSignaturesForParticipant("training-1", "participant-new");

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fnName).toBe("send-attendance-signature-request");
    expect(options.body.participantIds).toEqual(["participant-new"]);
    expect(options.body.trainingId).toBe("training-1");
    expect(options.body.scheduleDate).toBe("2024-03-01");
    expect(options.body.period).toBe("morning");
  });

  it("counts errors when an invoke call throws", async () => {
    mockFrom.mockImplementationOnce(makeSentRows([
      { schedule_date: "2024-03-01", period: "morning" },
      { schedule_date: "2024-03-02", period: "afternoon" },
    ]));
    mockInvoke
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockRejectedValueOnce(new Error("Network error"));

    const result = await catchUpAttendanceSignaturesForParticipant("training-1", "participant-1");

    expect(result.sentSlots).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("returns { sentSlots: 0, errors: 1 } when the DB query fails", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      }),
    }));

    const result = await catchUpAttendanceSignaturesForParticipant("training-1", "participant-1");

    expect(result).toEqual({ sentSlots: 0, errors: 1 });
  });
});

describe("uploadSignedConvention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the upload-participant-convention edge function, never direct storage", async () => {
    mockInvoke.mockResolvedValue({ data: { fileUrl: "https://example.com/convention.pdf" }, error: null });
    const file = new File(["pdf"], "convention.pdf", { type: "application/pdf" });

    await uploadSignedConvention("training-1", "participant-1", file);

    expect(mockInvoke).toHaveBeenCalledWith("upload-participant-convention", expect.objectContaining({ body: expect.any(FormData) }));
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("passes participantId, trainingId and file in FormData", async () => {
    mockInvoke.mockResolvedValue({ data: { fileUrl: "https://example.com/convention.pdf" }, error: null });
    const file = new File(["pdf"], "convention.pdf", { type: "application/pdf" });

    await uploadSignedConvention("training-1", "participant-1", file);

    const [fnName, options] = mockInvoke.mock.calls[0] as [string, { body: FormData }];
    expect(fnName).toBe("upload-participant-convention");
    expect(options.body.get("trainingId")).toBe("training-1");
    expect(options.body.get("participantId")).toBe("participant-1");
    expect(options.body.get("file")).toBe(file);
  });

  it("returns the fileUrl from the edge function response", async () => {
    mockInvoke.mockResolvedValue({ data: { fileUrl: "https://example.com/convention.pdf" }, error: null });
    const file = new File(["pdf"], "convention.pdf", { type: "application/pdf" });

    const result = await uploadSignedConvention("training-1", "participant-1", file);

    expect(result).toBe("https://example.com/convention.pdf");
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("RLS violation") });
    const file = new File(["pdf"], "convention.pdf", { type: "application/pdf" });

    await expect(uploadSignedConvention("training-1", "participant-1", file)).rejects.toThrow("RLS violation");
  });
});
