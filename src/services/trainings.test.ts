import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock with chainable query builder ──────────────────────────────
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockGte = vi.fn();
const mockIn = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function resetChain() {
  // Default: all resolve to { data: [], error: null }
  const ok = { data: [], error: null };
  mockSingle.mockReturnValue({ data: {}, error: null });
  mockEq.mockReturnValue(ok);
  mockOrder.mockReturnValue(ok);
  mockGte.mockReturnValue({ order: mockOrder });
  mockIn.mockReturnValue({ gte: mockGte, order: mockOrder });
  mockLimit.mockReturnValue(ok);
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
    order: mockOrder,
    gte: mockGte,
    in: mockIn,
  });
  mockInsert.mockReturnValue(ok);
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
  supabase: { from: mockFrom },
}));

const {
  getTraining,
  deleteTraining,
  updateTraining,
  fetchAllTrainings,
} = await import("./trainings");

beforeEach(() => {
  vi.clearAllMocks();
  resetChain();
});

describe("trainings service", () => {
  describe("deleteTraining", () => {
    it("calls supabase delete with correct id", async () => {
      mockEq.mockReturnValue({ data: null, error: null });
      await deleteTraining("abc-123");
      expect(mockFrom).toHaveBeenCalledWith("trainings");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "abc-123");
    });

    it("throws when supabase returns an error", async () => {
      mockEq.mockReturnValue({ data: null, error: { message: "Not found" } });
      await expect(deleteTraining("bad-id")).rejects.toEqual({ message: "Not found" });
    });
  });

  describe("getTraining", () => {
    it("fetches a single training by id", async () => {
      const training = { id: "t1", training_name: "Test" };
      mockSingle.mockReturnValue({ data: training, error: null });
      const result = await getTraining("t1");
      expect(result).toEqual(training);
    });

    it("throws on error", async () => {
      mockSingle.mockReturnValue({ data: null, error: { message: "fail" } });
      await expect(getTraining("bad")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateTraining", () => {
    it("updates with correct params", async () => {
      mockEq.mockReturnValue({ data: null, error: null });
      await updateTraining("t1", { training_name: "Updated" });
      expect(mockFrom).toHaveBeenCalledWith("trainings");
      expect(mockUpdate).toHaveBeenCalledWith({ training_name: "Updated" });
      expect(mockEq).toHaveBeenCalledWith("id", "t1");
    });
  });

  describe("fetchAllTrainings", () => {
    it("returns trainings ordered by start_date", async () => {
      const trainings = [{ id: "1" }, { id: "2" }];
      mockOrder.mockReturnValue({ data: trainings, error: null });
      const result = await fetchAllTrainings();
      expect(result).toEqual(trainings);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });
  });
});
