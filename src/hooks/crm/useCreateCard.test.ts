import { describe, it, expect } from "vitest";
import { capitalizeName, normalizeEmail } from "@/lib/stringUtils";

/**
 * Tests for the card data normalization logic used in useCreateCard.
 * We test the pure normalization functions and the field defaulting rules
 * that useCreateCard applies before inserting into Supabase.
 */

// Replicate the normalization logic from useCreateCard (lines 29-50)
function buildInsertData(input: Record<string, unknown>, maxPos: number) {
  return {
    column_id: input.column_id,
    title: input.title,
    description_html: input.description_html || null,
    status_operational: input.status_operational || "TODAY",
    waiting_next_action_date: input.waiting_next_action_date || null,
    waiting_next_action_text: input.waiting_next_action_text || null,
    sales_status: input.sales_status || "OPEN",
    estimated_value: input.estimated_value ?? 0,
    quote_url: input.quote_url || null,
    position: maxPos + 1,
    first_name: capitalizeName(input.first_name as string),
    last_name: capitalizeName(input.last_name as string),
    phone: input.phone || null,
    company: input.company || null,
    email: normalizeEmail(input.email as string),
    linkedin_url: input.linkedin_url || null,
    service_type: input.service_type || null,
    acquisition_source: input.acquisition_source || null,
    brief_questions: (input.brief_questions || null) as unknown as null,
    raw_input: input.raw_input || null,
  };
}

describe("useCreateCard — buildInsertData logic", () => {
  const baseInput = {
    column_id: "col-1",
    title: "Test Card",
    first_name: "jean-pierre",
    last_name: "DE LA FONTAINE",
    email: "  JEAN@EXAMPLE.COM  ",
  };

  it("capitalizes names", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.first_name).toBe("Jean-Pierre");
    expect(data.last_name).toBe("De La Fontaine");
  });

  it("normalizes email to lowercase and trimmed", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.email).toBe("jean@example.com");
  });

  it("sets position to maxPos + 1", () => {
    expect(buildInsertData(baseInput, -1).position).toBe(0);
    expect(buildInsertData(baseInput, 5).position).toBe(6);
    expect(buildInsertData(baseInput, 99).position).toBe(100);
  });

  it("defaults status_operational to TODAY", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.status_operational).toBe("TODAY");
  });

  it("uses provided status_operational", () => {
    const data = buildInsertData({ ...baseInput, status_operational: "WAITING" }, 0);
    expect(data.status_operational).toBe("WAITING");
  });

  it("defaults sales_status to OPEN", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.sales_status).toBe("OPEN");
  });

  it("defaults estimated_value to 0", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.estimated_value).toBe(0);
  });

  it("preserves explicit estimated_value of 0", () => {
    const data = buildInsertData({ ...baseInput, estimated_value: 0 }, 0);
    expect(data.estimated_value).toBe(0);
  });

  it("nullifies empty optional fields", () => {
    const data = buildInsertData(baseInput, 0);
    expect(data.description_html).toBeNull();
    expect(data.quote_url).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.company).toBeNull();
    expect(data.linkedin_url).toBeNull();
    expect(data.service_type).toBeNull();
    expect(data.acquisition_source).toBeNull();
  });

  it("handles null/undefined names", () => {
    const data = buildInsertData({ ...baseInput, first_name: null, last_name: undefined }, 0);
    expect(data.first_name).toBeNull();
    expect(data.last_name).toBeNull();
  });

  it("handles null/undefined email", () => {
    const data = buildInsertData({ ...baseInput, email: null }, 0);
    expect(data.email).toBeNull();
  });
});
