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
  mockIn.mockReturnValue({ eq: vi.fn().mockReturnValue({ gte: mockGte, order: mockOrder }), gte: mockGte, order: mockOrder });
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
  fetchTrainingNames,
  fetchUpcomingTrainings,
  fetchSchedules,
  fetchParticipants,
  fetchLinkableTrainings,
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

  describe("fetchTrainingNames", () => {
    it("returns id and training_name ordered by start_date desc", async () => {
      const names = [{ id: "1", training_name: "A" }];
      mockOrder.mockReturnValue({ data: names, error: null });
      const result = await fetchTrainingNames();
      expect(result).toEqual(names);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });

    it("throws on error", async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: "fail" } });
      await expect(fetchTrainingNames()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("fetchUpcomingTrainings", () => {
    it("fetches trainings from a given date with limit 20", async () => {
      const upcoming = [{ id: "1", training_name: "Up" }];
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ data: upcoming, error: null });
      const result = await fetchUpcomingTrainings("2026-03-01");
      expect(result).toEqual(upcoming);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });
  });

  describe("fetchSchedules", () => {
    it("fetches schedules for a training id", async () => {
      const schedules = [{ id: "s1", day_date: "2026-03-10" }];
      const mockScheduleEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ data: schedules, error: null }) });
      mockSelect.mockReturnValue({
        eq: mockScheduleEq,
        order: mockOrder,
        gte: mockGte,
        in: mockIn,
      });
      const result = await fetchSchedules("t1");
      expect(result).toEqual(schedules);
      expect(mockFrom).toHaveBeenCalledWith("training_schedules");
    });
  });

  describe("fetchParticipants", () => {
    it("fetches participants for a training id", async () => {
      const participants = [{ id: "p1", name: "Alice" }];
      const mockParticipantEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ data: participants, error: null }) });
      mockSelect.mockReturnValue({
        eq: mockParticipantEq,
        order: mockOrder,
        gte: mockGte,
        in: mockIn,
      });
      const result = await fetchParticipants("t1");
      expect(result).toEqual(participants);
      expect(mockFrom).toHaveBeenCalledWith("training_participants");
    });
  });

  describe("fetchLinkableTrainings", () => {
    it("fetches inter/e-learning trainings from a date", async () => {
      const linkable = [{ id: "1", format_formation: "inter-entreprises" }];
      mockOrder.mockReturnValue({ data: linkable, error: null });
      const result = await fetchLinkableTrainings("2026-03-01");
      expect(result).toEqual(linkable);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });
  });
});
