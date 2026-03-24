import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockInvoke = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockOrder = vi.fn();

function resetChain() {
  const ok = { data: [], error: null };
  mockSingle.mockResolvedValue({ data: {}, error: null });
  mockLimit.mockReturnValue({ single: mockSingle });
  mockEq.mockReturnValue({ select: mockSelect, ...ok });
  mockOrder.mockReturnValue(ok);
  mockSelect.mockReturnValue({
    eq: mockEq,
    limit: mockLimit,
    order: mockOrder,
    single: mockSingle,
  });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockDelete.mockReturnValue({ eq: mockEq });
}

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: mockFrom,
  },
}));

const { lookupSiren, createQuote } = await import("./quotes");

beforeEach(() => {
  vi.clearAllMocks();
  resetChain();
});

// ── SIREN validation ─────────────────────────────────────────────────────────

describe("lookupSiren – SIREN validation", () => {
  it("accepts a valid 9-digit SIREN", async () => {
    // Arrange
    mockInvoke.mockResolvedValue({
      data: { nomClient: "Acme", adresse: "1 rue X", codePostal: "75001", ville: "Paris" },
      error: null,
    });

    // Act
    const result = await lookupSiren("123456789");

    // Assert
    expect(result.siren).toBe("123456789");
    expect(mockInvoke).toHaveBeenCalledWith("search-siren", {
      body: { siren: "123456789" },
    });
  });

  it("throws when SIREN has fewer than 9 digits", async () => {
    await expect(lookupSiren("12345678")).rejects.toThrow(
      "Le SIREN doit contenir exactement 9 chiffres."
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("throws when SIREN has more than 9 digits", async () => {
    await expect(lookupSiren("1234567890")).rejects.toThrow(
      "Le SIREN doit contenir exactement 9 chiffres."
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("accepts SIREN with spaces (whitespace is stripped)", async () => {
    // Arrange
    mockInvoke.mockResolvedValue({
      data: { nomClient: "Test", adresse: "", codePostal: "", ville: "" },
      error: null,
    });

    // Act
    const result = await lookupSiren("12 345 6789");

    // Assert
    expect(result.siren).toBe("123456789");
    expect(mockInvoke).toHaveBeenCalledWith("search-siren", {
      body: { siren: "123456789" },
    });
  });

  it("throws when SIREN contains non-digit characters", async () => {
    await expect(lookupSiren("abcdefghi")).rejects.toThrow(
      "Le SIREN doit contenir exactement 9 chiffres."
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

// ── VAT number calculation ───────────────────────────────────────────────────

describe("lookupSiren – VAT number calculation", () => {
  function setupInvokeMock() {
    mockInvoke.mockResolvedValue({
      data: { nomClient: "", adresse: "", codePostal: "", ville: "" },
      error: null,
    });
  }

  it("computes correct VAT for SIREN 443061841 → FR62443061841", async () => {
    // Arrange
    setupInvokeMock();

    // Act
    const result = await lookupSiren("443061841");

    // Assert – 443061841 % 97 = 82; (12 + 3*82) % 97 = 258 % 97 = 64
    expect(result.vatNumber).toBe("FR64443061841");
  });

  it("computes correct VAT for SIREN 732829320", async () => {
    // Arrange
    setupInvokeMock();

    // Act
    const result = await lookupSiren("732829320");

    // Assert – 732829320 % 97 = 732829320 - 97*7555972 = 732829320 - 732929084 ... let's compute:
    // 732829320 / 97 = 7555044.53... → floor = 7555044 → 97*7555044 = 732839268
    // Wait: 97 * 7555044 = 97*7000000 + 97*555044 = 679000000 + 53839268 = 732839268
    // 732829320 - 732839268 = -9948 — that's wrong. Let me recompute:
    // 97 * 7555000 = 732835000; 732829320 - 732835000 = -5680 — still negative
    // 97 * 7554940 = 97*7554000 + 97*940 = 732738000 + 91180 = 732829180
    // 732829320 - 732829180 = 140; but 140 > 97, so +1: 97*7554941 = 732829180+97 = 732829277
    // 732829320 - 732829277 = 43; so sirenNum % 97 = 43
    // key = (12 + 3*43) % 97 = (12 + 129) % 97 = 141 % 97 = 44
    expect(result.vatNumber).toBe("FR44732829320");
  });

  it("computes correct VAT for edge-case SIREN 000000001", async () => {
    // Arrange
    setupInvokeMock();

    // Act
    const result = await lookupSiren("000000001");

    // Assert – 1 % 97 = 1; (12 + 3*1) % 97 = 15 % 97 = 15
    expect(result.vatNumber).toBe("FR15000000001");
  });
});

// ── Quote number generation ──────────────────────────────────────────────────

describe("createQuote – quote number generation", () => {
  function setupSettingsMock(prefix: string, seq: number, validityDays = 30) {
    // First call: fetchQuoteSettings → limit(1).single()
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "settings-1",
        quote_prefix: prefix,
        next_sequence_number: seq,
        default_validity_days: validityDays,
        default_sale_type: "service",
        rights_transfer_enabled: false,
        rights_transfer_rate: 0,
      },
      error: null,
    });
  }

  function setupInsertMock(quoteNumber: string) {
    // insert().select().single() chain for the created quote
    const createdQuote = {
      id: "q-1",
      quote_number: quoteNumber,
      crm_card_id: "card-1",
    };
    mockSingle.mockResolvedValueOnce({ data: createdQuote, error: null });
    // update sequence → eq returns success
    mockEq.mockReturnValue({ data: null, error: null });
  }

  it("generates DEV-2026-0001 for seq=1", async () => {
    // Arrange
    const expectedNumber = "DEV-2026-0001";
    setupSettingsMock("DEV", 1);
    setupInsertMock(expectedNumber);

    // Act
    const quote = await createQuote({
      crm_card_id: "card-1",
      client_company: "Test Co",
    } as any);

    // Assert — verify the insert was called with the correct quote_number
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ quote_number: expectedNumber })
    );
  });

  it("generates DEV-2026-9999 for seq=9999", async () => {
    // Arrange
    const expectedNumber = "DEV-2026-9999";
    setupSettingsMock("DEV", 9999);
    setupInsertMock(expectedNumber);

    // Act
    await createQuote({ crm_card_id: "card-1", client_company: "X" } as any);

    // Assert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ quote_number: expectedNumber })
    );
  });

  it("generates DEV-2026-10000 for seq=10000 (no truncation)", async () => {
    // Arrange
    const expectedNumber = "DEV-2026-10000";
    setupSettingsMock("DEV", 10000);
    setupInsertMock(expectedNumber);

    // Act
    await createQuote({ crm_card_id: "card-1", client_company: "X" } as any);

    // Assert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ quote_number: expectedNumber })
    );
  });
});

// ── Expiry date calculation ──────────────────────────────────────────────────

describe("createQuote – expiry date calculation", () => {
  it("calculates expiry as issue_date + default_validity_days", async () => {
    // Arrange
    const fakeNow = new Date("2026-03-01T00:00:00Z");
    vi.setSystemTime(fakeNow);

    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: "s-1",
          quote_prefix: "DEV",
          next_sequence_number: 1,
          default_validity_days: 30,
          default_sale_type: "service",
          rights_transfer_enabled: false,
          rights_transfer_rate: 0,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "q-1", quote_number: "DEV-2026-0001" },
        error: null,
      });
    mockEq.mockReturnValue({ data: null, error: null });

    // Act
    await createQuote({ crm_card_id: "card-1", client_company: "X" } as any);

    // Assert — 2026-03-01 + 30 days = 2026-03-31
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_date: "2026-03-01",
        expiry_date: "2026-03-31",
      })
    );

    vi.useRealTimers();
  });

  it("uses explicit expiry_date when provided (overrides calculation)", async () => {
    // Arrange
    const fakeNow = new Date("2026-03-01T00:00:00Z");
    vi.setSystemTime(fakeNow);

    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: "s-1",
          quote_prefix: "DEV",
          next_sequence_number: 1,
          default_validity_days: 30,
          default_sale_type: "service",
          rights_transfer_enabled: false,
          rights_transfer_rate: 0,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "q-1", quote_number: "DEV-2026-0001" },
        error: null,
      });
    mockEq.mockReturnValue({ data: null, error: null });

    // Act
    await createQuote({
      crm_card_id: "card-1",
      client_company: "X",
      expiry_date: "2026-12-31",
    } as any);

    // Assert — explicit date is used, not the calculated one
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        expiry_date: "2026-12-31",
      })
    );

    vi.useRealTimers();
  });
});
