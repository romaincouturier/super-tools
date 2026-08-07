import { describe, it, expect } from "vitest";
import { cfpStatus, eventOutcome } from "./event-tools.ts";

const TODAY = "2026-08-07";

describe("eventOutcome", () => {
  it("distingue un refus de CFP d'une annulation ordinaire", () => {
    expect(eventOutcome({ status: "cancelled", cancellation_reason: "non_selectionne", event_date: "2026-05-01" }, TODAY))
      .toBe("not_selected");
    expect(eventOutcome({ status: "cancelled", cancellation_reason: "report", event_date: "2026-05-01" }, TODAY))
      .toBe("cancelled");
    expect(eventOutcome({ status: "cancelled", cancellation_reason: null, event_date: "2026-05-01" }, TODAY))
      .toBe("cancelled");
  });

  it("sépare le passé tenu du à venir", () => {
    expect(eventOutcome({ status: "active", cancellation_reason: null, event_date: "2026-08-06" }, TODAY)).toBe("held");
    expect(eventOutcome({ status: "active", cancellation_reason: null, event_date: TODAY }, TODAY)).toBe("upcoming");
    expect(eventOutcome({ status: "active", cancellation_reason: null, event_date: "2026-09-01" }, TODAY)).toBe("upcoming");
  });

  it("laisse l'annulation primer sur la date", () => {
    expect(eventOutcome({ status: "cancelled", cancellation_reason: "non_selectionne", event_date: "2026-12-01" }, TODAY))
      .toBe("not_selected");
  });
});

describe("cfpStatus", () => {
  it("ne parle de CFP que s'il y en a un", () => {
    expect(cfpStatus({})).toBe("no_cfp");
    expect(cfpStatus({ cfp_deadline: "2026-04-01" })).toBe("not_submitted");
    expect(cfpStatus({ cfp_url: "https://example.org/cfp" })).toBe("not_submitted");
    expect(cfpStatus({ cfp_deadline: "2026-04-01", cfp_submitted_at: "2026-03-28T10:00:00Z" })).toBe("submitted");
  });

  it("considère soumis un CFP sans deadline ni URL renseignées", () => {
    expect(cfpStatus({ cfp_submitted_at: "2026-03-28T10:00:00Z" })).toBe("submitted");
  });
});
