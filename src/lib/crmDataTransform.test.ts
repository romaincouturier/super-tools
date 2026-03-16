import { describe, it, expect } from "vitest";
import {
  mapColumns,
  mapTags,
  mapCards,
  mapAttachments,
  mapComments,
  mapActivity,
  mapEmails,
} from "./crmDataTransform";

describe("mapColumns", () => {
  it("maps raw rows to CrmColumn objects", () => {
    const raw = [
      { id: "1", name: "Prospects", position: 0, is_archived: false, created_at: "2026-01-01", updated_at: "2026-01-02", extra_field: "ignored" },
    ];
    const result = mapColumns(raw);
    expect(result).toEqual([
      { id: "1", name: "Prospects", position: 0, is_archived: false, created_at: "2026-01-01", updated_at: "2026-01-02" },
    ]);
  });

  it("handles null/empty data", () => {
    expect(mapColumns([])).toEqual([]);
    expect(mapColumns(null as never)).toEqual([]);
  });
});

describe("mapTags", () => {
  it("maps raw rows to CrmTag objects", () => {
    const raw = [
      { id: "t1", name: "Hot", color: "#ff0000", category: "priority", created_at: "2026-01-01" },
    ];
    expect(mapTags(raw)).toEqual([
      { id: "t1", name: "Hot", color: "#ff0000", category: "priority", created_at: "2026-01-01" },
    ]);
  });

  it("handles empty data", () => {
    expect(mapTags([])).toEqual([]);
    expect(mapTags(null as never)).toEqual([]);
  });
});

describe("mapCards", () => {
  const tags = [
    { id: "t1", name: "Hot", color: "#ff0000", category: "priority", created_at: "2026-01-01" },
    { id: "t2", name: "Cold", color: "#0000ff", category: "priority", created_at: "2026-01-01" },
  ];

  it("maps raw card data and resolves tags via cardTagRows", () => {
    const cards = [
      {
        id: "c1", column_id: "col1", title: "Deal A", description_html: "<p>test</p>",
        status_operational: "active", waiting_next_action_date: null, waiting_next_action_text: null,
        sales_status: "new", estimated_value: 5000, quote_url: null,
        position: 0, created_at: "2026-01-01", updated_at: "2026-01-02",
        first_name: "Jean", last_name: "Dupont", phone: "0600000000",
        company: "ACME", email: "jean@acme.fr", linkedin_url: null,
        service_type: "formation", brief_questions: [], raw_input: null,
      },
    ];
    const cardTagRows = [{ card_id: "c1", tag_id: "t1" }];

    const result = mapCards(cards, cardTagRows, tags);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
    expect(result[0].title).toBe("Deal A");
    expect(result[0].tags).toEqual([tags[0]]);
  });

  it("returns empty array for empty data", () => {
    expect(mapCards([], [], tags)).toEqual([]);
    expect(mapCards(null as never, [], tags)).toEqual([]);
  });

  it("handles card with no tags", () => {
    const cards = [
      {
        id: "c2", column_id: "col1", title: "Deal B", description_html: null,
        status_operational: null, waiting_next_action_date: null, waiting_next_action_text: null,
        sales_status: null, estimated_value: null, quote_url: null,
        position: 1, created_at: "2026-01-01", updated_at: "2026-01-01",
        first_name: null, last_name: null, phone: null,
        company: null, email: null, linkedin_url: null,
        service_type: null, brief_questions: null, raw_input: null,
      },
    ];
    const result = mapCards(cards, [], tags);
    expect(result[0].tags).toEqual([]);
    expect(result[0].estimated_value).toBe(0);
    expect(result[0].brief_questions).toEqual([]);
  });
});

describe("mapAttachments", () => {
  it("maps raw rows to CrmAttachment objects", () => {
    const raw = [
      { id: "a1", card_id: "c1", file_name: "doc.pdf", file_path: "/files/doc.pdf", file_size: 1024, mime_type: "application/pdf", created_at: "2026-01-01" },
    ];
    expect(mapAttachments(raw)).toEqual([
      { id: "a1", card_id: "c1", file_name: "doc.pdf", file_path: "/files/doc.pdf", file_size: 1024, mime_type: "application/pdf", created_at: "2026-01-01" },
    ]);
  });

  it("handles empty data", () => {
    expect(mapAttachments([])).toEqual([]);
    expect(mapAttachments(null as never)).toEqual([]);
  });
});

describe("mapComments", () => {
  it("maps raw rows to CrmComment objects", () => {
    const raw = [
      { id: "cm1", card_id: "c1", author_email: "user@test.fr", content: "Hello", is_deleted: false, created_at: "2026-01-01" },
    ];
    expect(mapComments(raw)).toEqual([
      { id: "cm1", card_id: "c1", author_email: "user@test.fr", content: "Hello", is_deleted: false, created_at: "2026-01-01" },
    ]);
  });

  it("handles empty data", () => {
    expect(mapComments(null as never)).toEqual([]);
  });
});

describe("mapActivity", () => {
  it("maps raw rows to CrmActivityLog objects", () => {
    const raw = [
      { id: "al1", card_id: "c1", action_type: "card_moved", old_value: "col1", new_value: "col2", metadata: { by: "user" }, actor_email: "user@test.fr", created_at: "2026-01-01" },
    ];
    const result = mapActivity(raw);
    expect(result[0].action_type).toBe("card_moved");
    expect(result[0].metadata).toEqual({ by: "user" });
  });

  it("handles null metadata", () => {
    const raw = [
      { id: "al2", card_id: "c1", action_type: "note_added", old_value: null, new_value: "note", metadata: null, actor_email: "user@test.fr", created_at: "2026-01-01" },
    ];
    expect(mapActivity(raw)[0].metadata).toBeNull();
  });
});

describe("mapEmails", () => {
  it("maps raw rows to CrmCardEmail objects with defaults", () => {
    const raw = [
      { id: "e1", card_id: "c1", sender_email: "a@b.fr", recipient_email: "c@d.fr", subject: "Test", body_html: "<p>hi</p>", sent_at: "2026-01-01" },
    ];
    const result = mapEmails(raw);
    expect(result[0].id).toBe("e1");
    expect(result[0].attachment_names).toEqual([]);
    expect(result[0].delivery_status).toBe("sent");
    expect(result[0].open_count).toBe(0);
    expect(result[0].click_count).toBe(0);
  });

  it("preserves existing email tracking fields", () => {
    const raw = [
      {
        id: "e2", card_id: "c1", sender_email: "a@b.fr", recipient_email: "c@d.fr",
        subject: "Test", body_html: "<p>hi</p>", sent_at: "2026-01-01",
        attachment_names: ["file.pdf"], delivery_status: "delivered",
        open_count: 3, click_count: 1, opened_at: "2026-01-02", clicked_at: "2026-01-03",
        resend_email_id: "re1", attachment_paths: ["/p"], delivered_at: "2026-01-01T12:00:00",
      },
    ];
    const result = mapEmails(raw);
    expect(result[0].attachment_names).toEqual(["file.pdf"]);
    expect(result[0].delivery_status).toBe("delivered");
    expect(result[0].open_count).toBe(3);
    expect(result[0].click_count).toBe(1);
    expect(result[0].resend_email_id).toBe("re1");
  });
});
