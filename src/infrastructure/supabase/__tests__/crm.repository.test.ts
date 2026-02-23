import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseCrmRepository } from "../crm.repository";

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
    "filter",
    "contains",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("SupabaseCrmRepository", () => {
  let repo: SupabaseCrmRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SupabaseCrmRepository();
  });

  describe("fetchBoardData", () => {
    it("fetches columns, cards, tags and assigns tags to cards", async () => {
      const columnsData = [
        {
          id: "col-1",
          name: "Prospects",
          position: 0,
          is_archived: false,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ];
      const cardsData = [
        {
          id: "card-1",
          column_id: "col-1",
          title: "Card A",
          description_html: null,
          status_operational: "TODAY",
          waiting_next_action_date: null,
          waiting_next_action_text: null,
          sales_status: "OPEN",
          estimated_value: 5000,
          quote_url: null,
          position: 0,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          first_name: "John",
          last_name: "Doe",
          phone: null,
          company: "Acme",
          email: "john@acme.com",
          linkedin_url: null,
          service_type: "formation",
          brief_questions: [],
          raw_input: null,
        },
      ];
      const tagsData = [
        {
          id: "tag-1",
          name: "VIP",
          color: "#ff0000",
          category: "priority",
          created_at: "2024-01-01",
        },
      ];
      const cardTagsData = [{ card_id: "card-1", tag_id: "tag-1" }];

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case "crm_columns":
            return chainable(columnsData);
          case "crm_cards":
            return chainable(cardsData);
          case "crm_tags":
            return chainable(tagsData);
          case "crm_card_tags":
            return chainable(cardTagsData);
          default:
            return chainable();
        }
      });

      const result = await repo.fetchBoardData();

      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe("Prospects");
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].title).toBe("Card A");
      expect(result.cards[0].tags).toHaveLength(1);
      expect(result.cards[0].tags[0].name).toBe("VIP");
      expect(result.tags).toHaveLength(1);
    });

    it("returns empty arrays when no data exists", async () => {
      mockFrom.mockReturnValue(chainable([]));
      const result = await repo.fetchBoardData();
      expect(result.columns).toEqual([]);
      expect(result.cards).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it("handles null data as empty arrays", async () => {
      mockFrom.mockReturnValue(chainable(null));
      const result = await repo.fetchBoardData();
      expect(result.columns).toEqual([]);
      expect(result.cards).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it("throws when columns fetch fails", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "crm_columns") return chainable(null, { message: "error" });
        return chainable([]);
      });
      await expect(repo.fetchBoardData()).rejects.toEqual({ message: "error" });
    });

    it("throws when cards fetch fails", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "crm_cards") return chainable(null, { message: "error" });
        return chainable([]);
      });
      await expect(repo.fetchBoardData()).rejects.toEqual({ message: "error" });
    });

    it("defaults estimated_value to 0 when null", async () => {
      const cardsData = [
        {
          id: "card-1",
          column_id: "col-1",
          title: "No Value",
          description_html: null,
          status_operational: "TODAY",
          waiting_next_action_date: null,
          waiting_next_action_text: null,
          sales_status: "OPEN",
          estimated_value: null,
          quote_url: null,
          position: 0,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          first_name: null,
          last_name: null,
          phone: null,
          company: null,
          email: null,
          linkedin_url: null,
          service_type: null,
          brief_questions: null,
          raw_input: null,
        },
      ];
      mockFrom.mockImplementation((table: string) => {
        if (table === "crm_cards") return chainable(cardsData);
        return chainable([]);
      });

      const result = await repo.fetchBoardData();
      expect(result.cards[0].estimated_value).toBe(0);
      expect(result.cards[0].brief_questions).toEqual([]);
    });
  });

  describe("fetchCardDetails", () => {
    it("fetches attachments, comments, activity and emails", async () => {
      const attachments = [
        {
          id: "att-1",
          card_id: "card-1",
          file_name: "doc.pdf",
          file_path: "p/doc.pdf",
          file_size: 1024,
          mime_type: "application/pdf",
          created_at: "2024-01-01",
        },
      ];
      const comments = [
        {
          id: "com-1",
          card_id: "card-1",
          author_email: "u@t.com",
          content: "OK",
          is_deleted: false,
          created_at: "2024-01-01",
        },
      ];
      const activity = [
        {
          id: "act-1",
          card_id: "card-1",
          action_type: "card_created",
          old_value: null,
          new_value: "A",
          metadata: null,
          actor_email: "u@t.com",
          created_at: "2024-01-01",
        },
      ];
      const emails = [
        {
          id: "em-1",
          card_id: "card-1",
          sender_email: "a@b.com",
          recipient_email: "c@d.com",
          subject: "Hi",
          body_html: "<p>Hi</p>",
          sent_at: "2024-01-01",
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case "crm_attachments":
            return chainable(attachments);
          case "crm_comments":
            return chainable(comments);
          case "crm_activity_log":
            return chainable(activity);
          case "crm_card_emails":
            return chainable(emails);
          default:
            return chainable();
        }
      });

      const result = await repo.fetchCardDetails("card-1");
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].file_name).toBe("doc.pdf");
      expect(result.comments).toHaveLength(1);
      expect(result.activity).toHaveLength(1);
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe("Hi");
    });

    it("returns empty arrays when no details exist", async () => {
      mockFrom.mockReturnValue(chainable([]));
      const result = await repo.fetchCardDetails("card-empty");
      expect(result.attachments).toEqual([]);
      expect(result.comments).toEqual([]);
      expect(result.activity).toEqual([]);
      expect(result.emails).toEqual([]);
    });
  });

  describe("logActivity", () => {
    it("inserts an activity log entry", async () => {
      const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
      mockFrom.mockReturnValue({ insert: mockInsert });

      await repo.logActivity("card-1", "card_created", "user@test.com", null, "New Card");

      expect(mockFrom).toHaveBeenCalledWith("crm_activity_log");
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          card_id: "card-1",
          action_type: "card_created",
          actor_email: "user@test.com",
          old_value: null,
          new_value: "New Card",
        }),
      ]);
    });

    it("passes metadata when provided", async () => {
      const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
      mockFrom.mockReturnValue({ insert: mockInsert });

      await repo.logActivity("card-1", "card_moved", "u@t.com", "col-1", "col-2", {
        reason: "test",
      });

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          old_value: "col-1",
          new_value: "col-2",
          metadata: { reason: "test" },
        }),
      ]);
    });
  });
});
