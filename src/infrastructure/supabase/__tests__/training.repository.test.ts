import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseTrainingRepository } from "../training.repository";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "is",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "insert",
    "update",
    "delete",
    "upsert",
    "filter",
    "contains",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("SupabaseTrainingRepository", () => {
  let repo: SupabaseTrainingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SupabaseTrainingRepository();
  });

  describe("findById", () => {
    it("returns a training by id", async () => {
      const training = { id: "tr-1", title: "React Avancé", status: "active" };
      mockFrom.mockReturnValue(chainable(training));

      const result = await repo.findById("tr-1");
      expect(mockFrom).toHaveBeenCalledWith("trainings");
      expect(result).toEqual(training);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "not found" }));
      await expect(repo.findById("bad")).rejects.toEqual({ message: "not found" });
    });
  });

  describe("updateField", () => {
    it("updates training fields", async () => {
      const chain = chainable(null, null);
      mockFrom.mockReturnValue(chain);

      await repo.updateField("tr-1", { title: "New Title" });
      expect(mockFrom).toHaveBeenCalledWith("trainings");
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith({
        title: "New Title",
      });
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.updateField("tr-1", {})).rejects.toEqual({ message: "error" });
    });
  });

  describe("findSchedules", () => {
    it("returns schedules ordered by day_date", async () => {
      const schedules = [
        { id: "s-1", training_id: "tr-1", day_date: "2024-03-01" },
        { id: "s-2", training_id: "tr-1", day_date: "2024-03-02" },
      ];
      mockFrom.mockReturnValue(chainable(schedules));

      const result = await repo.findSchedules("tr-1");
      expect(result).toHaveLength(2);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.findSchedules("tr-1")).rejects.toEqual({ message: "error" });
    });
  });

  describe("findParticipants", () => {
    it("returns participants for a training", async () => {
      const participants = [
        {
          id: "p-1",
          training_id: "tr-1",
          first_name: "Alice",
          last_name: "Martin",
          email: "alice@test.com",
        },
      ];
      mockFrom.mockReturnValue(chainable(participants));

      const result = await repo.findParticipants("tr-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("findScheduledActions", () => {
    it("maps database rows to ScheduledAction objects", async () => {
      const actions = [
        {
          id: "a-1",
          description: "Send docs",
          due_date: "2024-03-15",
          assigned_user_email: "user@test.com",
          assigned_user_name: "User",
          status: "pending",
        },
        {
          id: "a-2",
          description: "Follow up",
          due_date: "2024-03-20",
          assigned_user_email: "user@test.com",
          assigned_user_name: null,
          status: "completed",
        },
      ];
      mockFrom.mockReturnValue(chainable(actions));

      const result = await repo.findScheduledActions("tr-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "a-1",
          description: "Send docs",
          assignedEmail: "user@test.com",
          assignedName: "User",
          completed: false,
        }),
      );
      expect(result[1].completed).toBe(true);
      expect(result[1].assignedName).toBe("");
    });
  });

  describe("toggleActionComplete", () => {
    it("sets status to completed with timestamp", async () => {
      const chain = chainable(null, null);
      mockFrom.mockReturnValue(chain);

      await repo.toggleActionComplete("a-1", true);
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
    });

    it("sets status to pending with null completed_at", async () => {
      const chain = chainable(null, null);
      mockFrom.mockReturnValue(chain);

      await repo.toggleActionComplete("a-1", false);
      expect((chain as Record<string, ReturnType<typeof vi.fn>>).update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", completed_at: null }),
      );
    });
  });

  describe("deleteAction", () => {
    it("deletes an action by id", async () => {
      mockFrom.mockReturnValue(chainable(null, null));
      await repo.deleteAction("a-1");
      expect(mockFrom).toHaveBeenCalledWith("training_actions");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(repo.deleteAction("a-1")).rejects.toEqual({ message: "error" });
    });
  });

  describe("findAssignedUserName", () => {
    it("returns full name when first and last name exist", async () => {
      mockFrom.mockReturnValue(
        chainable({ first_name: "Alice", last_name: "Martin", email: "alice@test.com" }),
      );
      const result = await repo.findAssignedUserName("user-1");
      expect(result).toBe("Alice Martin");
    });

    it("returns email prefix when no name", async () => {
      mockFrom.mockReturnValue(
        chainable({ first_name: null, last_name: null, email: "alice@test.com" }),
      );
      const result = await repo.findAssignedUserName("user-1");
      expect(result).toBe("alice");
    });

    it("returns null when no profile found", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await repo.findAssignedUserName("unknown");
      expect(result).toBeNull();
    });
  });

  describe("findThankYouSentDate", () => {
    it("returns created_at when log exists", async () => {
      mockFrom.mockReturnValue(chainable({ created_at: "2024-03-15T10:00:00Z" }));
      const result = await repo.findThankYouSentDate("tr-1");
      expect(result).toBe("2024-03-15T10:00:00Z");
    });

    it("returns null when no log found", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await repo.findThankYouSentDate("tr-1");
      expect(result).toBeNull();
    });
  });

  describe("logActivity", () => {
    it("inserts into activity_logs", async () => {
      const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
      mockFrom.mockReturnValue({ insert: mockInsert });

      await repo.logActivity({
        actionType: "thank_you_email_sent",
        recipientEmail: "user@test.com",
        details: { training_id: "tr-1" },
        userId: "user-1",
      });

      expect(mockFrom).toHaveBeenCalledWith("activity_logs");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: "thank_you_email_sent",
          recipient_email: "user@test.com",
          details: { training_id: "tr-1" },
          user_id: "user-1",
        }),
      );
    });

    it("defaults details and userId to null", async () => {
      const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
      mockFrom.mockReturnValue({ insert: mockInsert });

      await repo.logActivity({
        actionType: "test",
        recipientEmail: "u@t.com",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ details: null, user_id: null }),
      );
    });
  });
});
