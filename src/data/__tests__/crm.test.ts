import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBoardData, fetchCardDetails, logCrmActivity } from "../crm";

// Mock supabase
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Helper to create a chainable query mock
function chainable(data: unknown = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "in", "is", "order", "limit", "single", "maybeSingle", "insert", "update", "delete", "filter"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make it thenable
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

describe("fetchBoardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches columns, cards, tags and card_tags in parallel", async () => {
    const columnsData = [
      { id: "col-1", name: "Prospects", position: 0, is_archived: false, created_at: "2024-01-01", updated_at: "2024-01-01" },
      { id: "col-2", name: "Négociation", position: 1, is_archived: false, created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];

    const cardsData = [
      {
        id: "card-1", column_id: "col-1", title: "Test Card", description_html: null,
        status_operational: "TODAY", waiting_next_action_date: null, waiting_next_action_text: null,
        sales_status: "OPEN", estimated_value: 5000, quote_url: null, position: 0,
        created_at: "2024-01-01", updated_at: "2024-01-01",
        first_name: "John", last_name: "Doe", phone: null, company: "Acme",
        email: "john@acme.com", linkedin_url: null, service_type: "formation",
        brief_questions: [], raw_input: null,
      },
    ];

    const tagsData = [
      { id: "tag-1", name: "VIP", color: "#ff0000", category: "priority", created_at: "2024-01-01" },
    ];

    const cardTagsData = [
      { card_id: "card-1", tag_id: "tag-1" },
    ];

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

    const result = await fetchBoardData();

    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].name).toBe("Prospects");
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].title).toBe("Test Card");
    expect(result.cards[0].estimated_value).toBe(5000);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe("VIP");

    // Card should have its tags assigned
    expect(result.cards[0].tags).toHaveLength(1);
    expect(result.cards[0].tags[0].name).toBe("VIP");
  });

  it("throws when columns fetch fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_columns") {
        return chainable(null, { message: "Permission denied" });
      }
      return chainable([]);
    });

    await expect(fetchBoardData()).rejects.toEqual({ message: "Permission denied" });
  });

  it("throws when cards fetch fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_cards") {
        return chainable(null, { message: "Table not found" });
      }
      return chainable([]);
    });

    await expect(fetchBoardData()).rejects.toEqual({ message: "Table not found" });
  });

  it("returns empty arrays when no data exists", async () => {
    mockFrom.mockReturnValue(chainable([]));

    const result = await fetchBoardData();

    expect(result.columns).toEqual([]);
    expect(result.cards).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("handles null data as empty arrays", async () => {
    mockFrom.mockReturnValue(chainable(null));

    const result = await fetchBoardData();

    expect(result.columns).toEqual([]);
    expect(result.cards).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("assigns correct tags to cards based on card_tags join", async () => {
    const tagsData = [
      { id: "tag-1", name: "Hot", color: "#ff0000", category: "temperature", created_at: "2024-01-01" },
      { id: "tag-2", name: "Cold", color: "#0000ff", category: "temperature", created_at: "2024-01-01" },
    ];

    const cardsData = [
      { id: "card-1", column_id: "col-1", title: "Card A", status_operational: "TODAY", sales_status: "OPEN", estimated_value: 0, position: 0, created_at: "2024-01-01", updated_at: "2024-01-01", first_name: null, last_name: null, phone: null, company: null, email: null, linkedin_url: null, service_type: null, brief_questions: [], raw_input: null, description_html: null, waiting_next_action_date: null, waiting_next_action_text: null, quote_url: null },
      { id: "card-2", column_id: "col-1", title: "Card B", status_operational: "TODAY", sales_status: "OPEN", estimated_value: 0, position: 1, created_at: "2024-01-01", updated_at: "2024-01-01", first_name: null, last_name: null, phone: null, company: null, email: null, linkedin_url: null, service_type: null, brief_questions: [], raw_input: null, description_html: null, waiting_next_action_date: null, waiting_next_action_text: null, quote_url: null },
    ];

    const cardTagsData = [
      { card_id: "card-1", tag_id: "tag-1" },
      { card_id: "card-1", tag_id: "tag-2" },
      { card_id: "card-2", tag_id: "tag-2" },
    ];

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "crm_columns": return chainable([]);
        case "crm_cards": return chainable(cardsData);
        case "crm_tags": return chainable(tagsData);
        case "crm_card_tags": return chainable(cardTagsData);
        default: return chainable();
      }
    });

    const result = await fetchBoardData();

    expect(result.cards[0].tags).toHaveLength(2);
    expect(result.cards[1].tags).toHaveLength(1);
    expect(result.cards[1].tags[0].name).toBe("Cold");
  });
});

describe("fetchCardDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches attachments, comments, activity and emails for a card", async () => {
    const attachmentsData = [
      { id: "att-1", card_id: "card-1", file_name: "doc.pdf", file_path: "path/doc.pdf", file_size: 1024, mime_type: "application/pdf", created_at: "2024-01-01" },
    ];

    const commentsData = [
      { id: "com-1", card_id: "card-1", author_email: "user@test.com", content: "Great!", is_deleted: false, created_at: "2024-01-01" },
    ];

    const activityData = [
      { id: "act-1", card_id: "card-1", action_type: "card_created", old_value: null, new_value: "Test", metadata: null, actor_email: "user@test.com", created_at: "2024-01-01" },
    ];

    const emailsData = [
      { id: "email-1", card_id: "card-1", sender_email: "me@test.com", recipient_email: "them@test.com", subject: "Hello", body_html: "<p>Hi</p>", sent_at: "2024-01-01" },
    ];

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "crm_attachments": return chainable(attachmentsData);
        case "crm_comments": return chainable(commentsData);
        case "crm_activity_log": return chainable(activityData);
        case "crm_card_emails": return chainable(emailsData);
        default: return chainable();
      }
    });

    const result = await fetchCardDetails("card-1");

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].file_name).toBe("doc.pdf");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].content).toBe("Great!");
    expect(result.activity).toHaveLength(1);
    expect(result.activity[0].action_type).toBe("card_created");
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].subject).toBe("Hello");
  });

  it("returns empty arrays when card has no details", async () => {
    mockFrom.mockReturnValue(chainable([]));

    const result = await fetchCardDetails("card-empty");

    expect(result.attachments).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.activity).toEqual([]);
    expect(result.emails).toEqual([]);
  });
});

describe("logCrmActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an activity log entry", async () => {
    const mockInsert = vi.fn().mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );
    mockFrom.mockReturnValue({ insert: mockInsert });

    await logCrmActivity("card-1", "card_created", "user@test.com", null, "New Card");

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
    const mockInsert = vi.fn().mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );
    mockFrom.mockReturnValue({ insert: mockInsert });

    await logCrmActivity("card-1", "card_moved", "user@test.com", "col-1", "col-2", { reason: "test" });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        old_value: "col-1",
        new_value: "col-2",
        metadata: { reason: "test" },
      }),
    ]);
  });
});
