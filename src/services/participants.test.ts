import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (vi.mock is hoisted, so variables must be too) ────────────
const {
  mockSingle,
  mockSelect,
  mockInsert,
  mockFrom,
  mockInvoke,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockFrom = vi.fn(() => ({
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
  return { mockSingle, mockSelect, mockInsert, mockFrom, mockInvoke };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: mockInvoke },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/file.pdf" } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
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
  type CreateParticipantInput,
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

  it("normalizes email to lowercase and trimmed", async () => {
    await createParticipant(baseInput);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.email).toBe("jean.dupont@example.com");
  });

  it("trims the company name", async () => {
    await createParticipant(baseInput);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.company).toBe("Acme Corp");
  });

  it("capitalizes first_name and last_name", async () => {
    await createParticipant(baseInput);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.first_name).toBe("Jean");
    expect(insertCall.last_name).toBe("Dupont");
  });

  it("includes formula fields when formulaId is provided", async () => {
    await createParticipant(baseInput);

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.formula).toBe("Standard");
    expect(insertCall.formula_id).toBe("formula-1");
  });

  it("excludes formula fields when formulaId is empty", async () => {
    await createParticipant({ ...baseInput, formulaId: "", formulaName: "" });

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.formula).toBeUndefined();
    expect(insertCall.formula_id).toBeUndefined();
  });

  it("excludes sponsor/financeur fields for intra-entreprise", async () => {
    await createParticipant({ ...baseInput, isInterEntreprise: false });

    const insertCall = mockInsert.mock.calls[0][0];
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

    const insertCall = mockInsert.mock.calls[0][0];
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

    const insertCall = mockInsert.mock.calls[0][0];
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
