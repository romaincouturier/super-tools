import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Chainable Supabase mock ────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOr = vi.fn();

const chainObj = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  ilike: vi.fn(() => chainObj),
  or: mockOr,
};

const mockFrom = vi.fn((..._args: unknown[]) => chainObj);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { searchMissions, createMission } from "./missions";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-wire chainable returns after clearAllMocks
  mockSelect.mockReturnValue(chainObj);
  mockInsert.mockReturnValue(chainObj);
  mockUpdate.mockReturnValue(chainObj);
  mockDelete.mockReturnValue(chainObj);
  mockEq.mockReturnValue(chainObj);
  mockOrder.mockReturnValue(chainObj);
  mockLimit.mockReturnValue(chainObj);
  mockOr.mockReturnValue(chainObj);
  mockFrom.mockReturnValue(chainObj);
});

// ── searchMissions ─────────────────────────────────────────────────────

describe("searchMissions", () => {
  it("returns empty array for empty string", async () => {
    const result = await searchMissions("");
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only string", async () => {
    const result = await searchMissions("   ");
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty array for tab/newline whitespace", async () => {
    const result = await searchMissions("\t\n");
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries supabase when term is non-empty", async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    const result = await searchMissions("acme");
    expect(result).toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith("missions");
  });
});

// ── createMission — contact auto-extraction ────────────────────────────

describe("createMission contact auto-extraction", () => {
  /**
   * Helper: set up the two chained queries that createMission performs:
   *   1. SELECT position (max position query) → mockLimit resolves
   *   2. INSERT mission … .select().single() → mockSingle resolves
   *   3. INSERT contact … → mockInsert resolves directly (no .select/.single)
   */
  function setupCreateMocks(
    existingPositions: { position: number }[],
    createdMission: Record<string, unknown>,
  ) {
    // First chain: select position → .eq → .order → .limit resolves
    mockLimit.mockResolvedValueOnce({ data: existingPositions, error: null });
    // Second chain: mission insert → returns chainObj so .select().single() works
    // mockInsert already returns chainObj by default from beforeEach
    // .single() resolves with the created mission
    mockSingle.mockResolvedValueOnce({ data: createdMission, error: null });
    // Third chain: contact insert → needs to resolve directly as a promise
    // We make the second call to mockInsert resolve as a promise
    mockInsert
      .mockReturnValueOnce(chainObj) // first call: mission insert (chainable)
      .mockResolvedValueOnce({ data: null, error: null }); // second call: contact insert
  }

  it('extracts email from "Jean Dupont jean@example.com"', async () => {
    const mission = { id: "m1", title: "Test", position: 0, status: "not_started" };
    setupCreateMocks([], mission);

    await createMission({ title: "Test", client_contact: "Jean Dupont jean@example.com" });

    // The contact insert is the second call to mockInsert (first is the mission insert)
    const contactInsertCalls = mockInsert.mock.calls;
    // Find the call that inserts a contact (has mission_id)
    const contactCall = contactInsertCalls.find(
      (call) => call[0]?.mission_id === "m1",
    );
    expect(contactCall).toBeDefined();
    expect(contactCall![0]).toMatchObject({
      mission_id: "m1",
      email: "jean@example.com",
      first_name: "Jean Dupont",
      is_primary: true,
      language: "fr",
      position: 0,
    });
  });

  it('extracts email when contact is just an email "contact@test.fr"', async () => {
    const mission = { id: "m2", title: "Test2", position: 0, status: "not_started" };
    setupCreateMocks([], mission);

    await createMission({ title: "Test2", client_contact: "contact@test.fr" });

    const contactCall = mockInsert.mock.calls.find(
      (call) => call[0]?.mission_id === "m2",
    );
    expect(contactCall).toBeDefined();
    expect(contactCall![0]).toMatchObject({
      mission_id: "m2",
      email: "contact@test.fr",
      first_name: null, // name part is empty after removing email → null
      is_primary: true,
    });
  });

  it("sets email to null when contact has no email", async () => {
    const mission = { id: "m3", title: "Test3", position: 0, status: "not_started" };
    setupCreateMocks([], mission);

    await createMission({ title: "Test3", client_contact: "No email here" });

    const contactCall = mockInsert.mock.calls.find(
      (call) => call[0]?.mission_id === "m3",
    );
    expect(contactCall).toBeDefined();
    expect(contactCall![0]).toMatchObject({
      mission_id: "m3",
      email: null,
      first_name: "No email here",
      is_primary: true,
    });
  });

  it("does not create contact when client_contact is empty", async () => {
    const mission = { id: "m4", title: "Test4", position: 0, status: "not_started" };
    // Only two DB calls: select position + insert mission
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    mockSingle.mockResolvedValueOnce({ data: mission, error: null });

    await createMission({ title: "Test4", client_contact: "" });

    // No contact insert — only the mission insert happened
    const contactCall = mockInsert.mock.calls.find(
      (call) => call[0]?.mission_id === "m4",
    );
    expect(contactCall).toBeUndefined();
  });
});

// ── createMission — position calculation ───────────────────────────────

describe("createMission position calculation", () => {
  it("sets position to maxPos + 1 when existing missions exist", async () => {
    const mission = { id: "m5", title: "New", position: 4, status: "not_started" };
    // Existing max position is 3
    mockLimit.mockResolvedValueOnce({ data: [{ position: 3 }], error: null });
    mockSingle.mockResolvedValueOnce({ data: mission, error: null });

    await createMission({ title: "New" });

    // The mission insert call should include position: 4
    const missionInsertCall = mockInsert.mock.calls.find(
      (call) => call[0]?.title === "New",
    );
    expect(missionInsertCall).toBeDefined();
    expect(missionInsertCall![0].position).toBe(4);
  });

  it("sets position to 0 when no existing missions", async () => {
    const mission = { id: "m6", title: "First", position: 0, status: "not_started" };
    // No existing missions → data is empty array
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    mockSingle.mockResolvedValueOnce({ data: mission, error: null });

    await createMission({ title: "First" });

    const missionInsertCall = mockInsert.mock.calls.find(
      (call) => call[0]?.title === "First",
    );
    expect(missionInsertCall).toBeDefined();
    // maxPosition = -1 (default), so position = -1 + 1 = 0
    expect(missionInsertCall![0].position).toBe(0);
  });

  it("sets position to 0 when data is null", async () => {
    const mission = { id: "m7", title: "Null", position: 0, status: "not_started" };
    // data is null (edge case)
    mockLimit.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: mission, error: null });

    await createMission({ title: "Null" });

    const missionInsertCall = mockInsert.mock.calls.find(
      (call) => call[0]?.title === "Null",
    );
    expect(missionInsertCall).toBeDefined();
    // existing is null, existing?.[0]?.position is undefined → maxPosition = -1 → position = 0
    expect(missionInsertCall![0].position).toBe(0);
  });
});
