import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateConvention,
  sendConventionEmail,
  sendConventionReminder,
  generateCertificates,
  sendTrainingDocuments,
  sendThankYouEmail,
  fetchDocumentsSentInfo,
  fetchConventionSignatureStatus,
  fetchPrograms,
  insertParticipant,
  updateParticipant,
  deleteParticipant,
} from "../formations";

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
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
    "filter",
    "contains",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("formations service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Edge function invocations ---

  describe("generateConvention", () => {
    it("invokes generate-convention-formation", async () => {
      mockInvoke.mockResolvedValue({
        data: { url: "https://example.com/convention.pdf" },
        error: null,
      });

      const result = await generateConvention({ trainingId: "tr-1" });

      expect(mockInvoke).toHaveBeenCalledWith("generate-convention-formation", {
        body: { trainingId: "tr-1" },
      });
      expect(result).toEqual({ url: "https://example.com/convention.pdf" });
    });

    it("throws on edge function error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "internal" } });
      await expect(generateConvention({ trainingId: "tr-1" })).rejects.toEqual({
        message: "internal",
      });
    });

    it("throws on data.error response", async () => {
      mockInvoke.mockResolvedValue({ data: { error: "Missing template" }, error: null });
      await expect(generateConvention({ trainingId: "tr-1" })).rejects.toThrow("Missing template");
    });
  });

  describe("sendConventionEmail", () => {
    it("invokes send-convention-email", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

      await sendConventionEmail({
        trainingId: "tr-1",
        conventionUrl: "https://example.com/conv.pdf",
        recipientEmail: "user@test.com",
      });

      expect(mockInvoke).toHaveBeenCalledWith("send-convention-email", {
        body: expect.objectContaining({
          trainingId: "tr-1",
          recipientEmail: "user@test.com",
        }),
      });
    });
  });

  describe("sendConventionReminder", () => {
    it("invokes send-convention-reminder", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
      await sendConventionReminder({ trainingId: "tr-1", participantId: "p-1" });
      expect(mockInvoke).toHaveBeenCalledWith("send-convention-reminder", {
        body: { trainingId: "tr-1", participantId: "p-1" },
      });
    });
  });

  describe("generateCertificates", () => {
    it("invokes generate-certificates", async () => {
      mockInvoke.mockResolvedValue({ data: { count: 3 }, error: null });
      const result = await generateCertificates({
        trainingId: "tr-1",
        participantIds: ["p-1", "p-2"],
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe("sendTrainingDocuments", () => {
    it("invokes send-training-documents", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
      await sendTrainingDocuments({ trainingId: "tr-1" });
      expect(mockInvoke).toHaveBeenCalledWith("send-training-documents", {
        body: { trainingId: "tr-1" },
      });
    });
  });

  describe("sendThankYouEmail", () => {
    it("invokes send-thank-you-email", async () => {
      mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
      await sendThankYouEmail({ trainingId: "tr-1", participantId: "p-1" });
      expect(mockInvoke).toHaveBeenCalledWith("send-thank-you-email", {
        body: { trainingId: "tr-1", participantId: "p-1" },
      });
    });

    it("throws on error", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "smtp error" } });
      await expect(sendThankYouEmail({ trainingId: "tr-1" })).rejects.toEqual({
        message: "smtp error",
      });
    });
  });

  // --- Activity logs ---

  describe("fetchDocumentsSentInfo", () => {
    it("returns dates for each action type", async () => {
      const logs = [
        {
          created_at: "2024-03-15T10:00:00Z",
          action_type: "convention_email_sent",
          details: { training_id: "tr-1" },
        },
        {
          created_at: "2024-03-14T10:00:00Z",
          action_type: "training_documents_sent",
          details: { training_id: "tr-1" },
        },
        {
          created_at: "2024-03-16T10:00:00Z",
          action_type: "thank_you_email_sent",
          details: { trainingId: "tr-1" },
        },
      ];
      mockFrom.mockReturnValue(chainable(logs));

      const result = await fetchDocumentsSentInfo("tr-1");

      expect(result.documentsSentAt).toBe("2024-03-14T10:00:00Z");
      expect(result.thankYouSentAt).toBe("2024-03-16T10:00:00Z");
      expect(result.conventionSentAt).toBe("2024-03-15T10:00:00Z");
    });

    it("returns null dates when no matching logs", async () => {
      mockFrom.mockReturnValue(chainable([]));

      const result = await fetchDocumentsSentInfo("tr-1");

      expect(result.documentsSentAt).toBeNull();
      expect(result.thankYouSentAt).toBeNull();
      expect(result.conventionSentAt).toBeNull();
    });

    it("filters by training_id in details", async () => {
      const logs = [
        {
          created_at: "2024-03-15T10:00:00Z",
          action_type: "training_documents_sent",
          details: { training_id: "tr-OTHER" },
        },
      ];
      mockFrom.mockReturnValue(chainable(logs));

      const result = await fetchDocumentsSentInfo("tr-1");
      expect(result.documentsSentAt).toBeNull();
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "error" }));
      await expect(fetchDocumentsSentInfo("tr-1")).rejects.toEqual({ message: "error" });
    });
  });

  describe("fetchConventionSignatureStatus", () => {
    it("returns signature status", async () => {
      const sig = { status: "signed", signed_at: "2024-03-15T10:00:00Z" };
      mockFrom.mockReturnValue(chainable(sig));

      const result = await fetchConventionSignatureStatus("tr-1");
      expect(result).toEqual(sig);
    });

    it("returns null when no signature", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await fetchConventionSignatureStatus("tr-1");
      expect(result).toBeNull();
    });
  });

  // --- Programs ---

  describe("fetchPrograms", () => {
    it("returns programs ordered by name", async () => {
      const programs = [
        { id: "1", name: "React" },
        { id: "2", name: "TypeScript" },
      ];
      mockFrom.mockReturnValue(chainable(programs));

      const result = await fetchPrograms();
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no programs", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await fetchPrograms();
      expect(result).toEqual([]);
    });
  });

  // --- Participants ---

  describe("insertParticipant", () => {
    it("inserts and returns participant", async () => {
      const participant = {
        id: "p-1",
        training_id: "tr-1",
        email: "alice@test.com",
        first_name: "Alice",
      };
      mockFrom.mockReturnValue(chainable(participant));

      const result = await insertParticipant({
        training_id: "tr-1",
        email: "alice@test.com",
        first_name: "Alice",
      });
      expect(result).toEqual(participant);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "duplicate email" }));
      await expect(
        insertParticipant({ training_id: "tr-1", email: "alice@test.com" }),
      ).rejects.toEqual({ message: "duplicate email" });
    });
  });

  describe("updateParticipant", () => {
    it("updates and returns participant", async () => {
      const updated = { id: "p-1", first_name: "Bob" };
      mockFrom.mockReturnValue(chainable(updated));

      const result = await updateParticipant("p-1", { first_name: "Bob" });
      expect(result).toEqual(updated);
    });
  });

  describe("deleteParticipant", () => {
    it("deletes a participant", async () => {
      mockFrom.mockReturnValue(chainable(null, null));
      await deleteParticipant("p-1");
      expect(mockFrom).toHaveBeenCalledWith("training_participants");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chainable(null, { message: "not found" }));
      await expect(deleteParticipant("p-bad")).rejects.toEqual({ message: "not found" });
    });
  });
});
