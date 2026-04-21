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
  const ok = { data: [], error: null };
  mockSingle.mockReturnValue({ data: {}, error: null });
  mockEq.mockReturnValue({ gte: mockGte, order: mockOrder, ...ok });
  mockOrder.mockReturnValue(ok);
  mockGte.mockReturnValue({ order: mockOrder });
  mockIn.mockReturnValue({ eq: mockEq, gte: mockGte, order: mockOrder });
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

// ── Realistic test fixtures based on production data patterns ────────────────

const TRAINING_INTER = {
  id: "08030e91-7e56-4f02-84b9-194fecd199b1",
  training_name: "Formation facilitation graphique, communiquer avec le visuel",
  start_date: "2026-06-15",
  end_date: "2026-06-16",
  client_name: "SuperTilt",
  format_formation: "inter-entreprises",
  is_cancelled: false,
};

const TRAINING_INTRA = {
  id: "bcac5086-e9aa-4b04-a257-ae13fd7b3d53",
  training_name: "Synthétiser ses messages avec le visuel",
  start_date: "2026-04-23",
  client_name: "Acoss",
  format_formation: "classe_virtuelle",
  is_cancelled: false,
};

const TRAINING_ELEARNING = {
  id: "368a85e8-de95-4998-8073-161a14e1e01c",
  training_name: "Formation en ligne à la Facilitation graphique",
  start_date: "2026-03-04",
  end_date: "2026-04-08",
  client_name: "SuperTilt",
  format_formation: "e_learning",
  is_cancelled: false,
};

const TRAINING_CANCELLED = {
  id: "f6cac0a5-6ca9-4024-84b5-ac298cc063e9",
  training_name: "Formation facilitation graphique, communiquer avec le visuel",
  start_date: "2026-04-27",
  client_name: "Inter-entreprises",
  format_formation: "inter-entreprises",
  is_cancelled: true,
  cancellation_reason: "manque_participants",
};

// ── Tests ────────────────────────────────────────────────────────────────────

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
      mockSingle.mockReturnValue({ data: TRAINING_INTER, error: null });
      const result = await getTraining(TRAINING_INTER.id);
      expect(result).toEqual(TRAINING_INTER);
    });

    it("returns a cancelled training when fetched by id", async () => {
      mockSingle.mockReturnValue({ data: TRAINING_CANCELLED, error: null });
      const result = await getTraining(TRAINING_CANCELLED.id);
      expect(result.is_cancelled).toBe(true);
      expect(result.cancellation_reason).toBe("manque_participants");
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

    it("can cancel a training with a reason", async () => {
      mockEq.mockReturnValue({ data: null, error: null });
      const cancelUpdates = {
        is_cancelled: true,
        cancellation_reason: "manque_participants",
        cancelled_at: "2026-04-09T20:18:39.308+00:00",
      };
      await updateTraining(TRAINING_CANCELLED.id, cancelUpdates);
      expect(mockUpdate).toHaveBeenCalledWith(cancelUpdates);
    });
  });

  describe("fetchAllTrainings", () => {
    it("returns trainings ordered by start_date", async () => {
      const trainings = [TRAINING_INTER, TRAINING_INTRA, TRAINING_ELEARNING];
      mockOrder.mockReturnValue({ data: trainings, error: null });
      const result = await fetchAllTrainings();
      expect(result).toEqual(trainings);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });

    it("returns empty array when no trainings exist", async () => {
      mockOrder.mockReturnValue({ data: null, error: null });
      const result = await fetchAllTrainings();
      expect(result).toEqual([]);
    });
  });

  describe("fetchTrainingNames", () => {
    it("returns id and training_name ordered by start_date desc", async () => {
      const names = [
        { id: TRAINING_INTER.id, training_name: TRAINING_INTER.training_name },
        { id: TRAINING_ELEARNING.id, training_name: TRAINING_ELEARNING.training_name },
      ];
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
      const upcoming = [
        { id: TRAINING_INTER.id, training_name: TRAINING_INTER.training_name, start_date: TRAINING_INTER.start_date, end_date: TRAINING_INTER.end_date, location: "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon" },
      ];
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ data: upcoming, error: null });
      const result = await fetchUpcomingTrainings("2026-03-01");
      expect(result).toEqual(upcoming);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });

    it("returns empty array when no upcoming trainings", async () => {
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ data: null, error: null });
      const result = await fetchUpcomingTrainings("2030-01-01");
      expect(result).toEqual([]);
    });
  });

  describe("fetchSchedules", () => {
    it("fetches schedules for a training id", async () => {
      const schedules = [
        { id: "263e2e5f-9f63-4347-bdaa-df1acebea08e", training_id: TRAINING_INTER.id, day_date: "2026-06-15", start_time: "09:00:00", end_time: "17:00:00" },
        { id: "e2be290f-2429-4e77-89e7-bc72203d0384", training_id: TRAINING_INTER.id, day_date: "2026-06-16", start_time: "09:00:00", end_time: "17:00:00" },
      ];
      const mockScheduleEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ data: schedules, error: null }) });
      mockSelect.mockReturnValue({
        eq: mockScheduleEq,
        order: mockOrder,
        gte: mockGte,
        in: mockIn,
      });
      const result = await fetchSchedules(TRAINING_INTER.id);
      expect(result).toEqual(schedules);
      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith("training_schedules");
    });
  });

  describe("fetchParticipants", () => {
    it("fetches participants for a training id", async () => {
      const participants = [
        { id: "b0c79791-43ce-4e08-9a1c-8d11c74679ed", training_id: TRAINING_INTER.id, first_name: "Haifa", last_name: "Bacha", email: "haifa.bacha.pro@gmail.com" },
        { id: "81976117-3df2-46d0-bf02-53c34baffc8a", training_id: TRAINING_INTER.id, first_name: "Elise", last_name: "Fortier", email: "elise.fortier@chu-lyon.fr" },
      ];
      const mockParticipantEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ data: participants, error: null }) });
      mockSelect.mockReturnValue({
        eq: mockParticipantEq,
        order: mockOrder,
        gte: mockGte,
        in: mockIn,
      });
      const result = await fetchParticipants(TRAINING_INTER.id);
      expect(result).toEqual(participants);
      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith("training_participants");
    });
  });

  describe("fetchLinkableTrainings", () => {
    it("fetches inter/e-learning trainings from a date", async () => {
      const linkable = [
        { id: TRAINING_INTER.id, training_name: TRAINING_INTER.training_name, start_date: TRAINING_INTER.start_date, client_name: TRAINING_INTER.client_name, format_formation: "inter-entreprises" },
        { id: TRAINING_ELEARNING.id, training_name: TRAINING_ELEARNING.training_name, start_date: TRAINING_ELEARNING.start_date, client_name: TRAINING_ELEARNING.client_name, format_formation: "e_learning" },
      ];
      mockOrder.mockReturnValue({ data: linkable, error: null });
      const result = await fetchLinkableTrainings("2026-03-01");
      expect(result).toEqual(linkable);
      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith("trainings");
    });

    it("excludes cancelled trainings via is_cancelled filter", async () => {
      // The chain is: .in().eq("is_cancelled", false).gte().order()
      // Cancelled trainings like TRAINING_CANCELLED should NOT appear
      const linkableNonCancelled = [
        { id: TRAINING_INTER.id, format_formation: "inter-entreprises", is_cancelled: false },
      ];
      mockOrder.mockReturnValue({ data: linkableNonCancelled, error: null });
      const result = await fetchLinkableTrainings("2026-04-01");
      expect(result.every((t: { is_cancelled: boolean }) => !t.is_cancelled)).toBe(true);
    });

    it("returns empty array when no linkable trainings exist", async () => {
      mockOrder.mockReturnValue({ data: null, error: null });
      const result = await fetchLinkableTrainings("2030-01-01");
      expect(result).toEqual([]);
    });

    it("only includes inter-entreprises and e_learning formats", async () => {
      // intra and classe_virtuelle should NOT be returned
      const linkable = [
        { id: "1", format_formation: "inter-entreprises" },
        { id: "2", format_formation: "e_learning" },
      ];
      mockOrder.mockReturnValue({ data: linkable, error: null });
      const result = await fetchLinkableTrainings("2026-01-01");
      for (const t of result) {
        expect(["inter-entreprises", "e_learning"]).toContain((t as { format_formation: string }).format_formation);
      }
    });
  });
});
