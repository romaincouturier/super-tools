import { describe, it, expect } from "vitest";
import { computeCoolingContacts, computeNetworkStats } from "./networkUtils";
import type { NetworkContact, NetworkAction, NetworkInteraction } from "@/types/reseau";

// ─── Helpers ───

const makeContact = (overrides: Partial<NetworkContact> = {}): NetworkContact => ({
  id: crypto.randomUUID(),
  user_id: "user-1",
  name: "Test Contact",
  context: null,
  warmth: "warm",
  linkedin_url: null,
  last_contact_date: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeAction = (
  overrides: Partial<NetworkAction> = {},
): NetworkAction & { contact: NetworkContact | null } => ({
  id: crypto.randomUUID(),
  user_id: "user-1",
  contact_id: "c-1",
  action_type: "email",
  message_draft: null,
  scheduled_week: null,
  status: "pending",
  result: null,
  done_at: null,
  created_at: "2026-03-01T00:00:00Z",
  contact: null,
  ...overrides,
});

const makeInteraction = (
  overrides: Partial<NetworkInteraction> = {},
): NetworkInteraction => ({
  id: crypto.randomUUID(),
  user_id: "user-1",
  contact_id: "c-1",
  interaction_type: "email",
  notes: null,
  created_at: "2026-03-10T00:00:00Z",
  ...overrides,
});

// ─── computeCoolingContacts ───

describe("computeCoolingContacts", () => {
  const now = new Date("2026-03-12T12:00:00Z");

  it("returns empty array when no contacts", () => {
    expect(computeCoolingContacts([], undefined, now)).toEqual([]);
  });

  it("does not flag recent contacts", () => {
    const contact = makeContact({
      warmth: "warm",
      last_contact_date: "2026-03-05",
    });
    const result = computeCoolingContacts([contact], undefined, now);
    expect(result).toHaveLength(0);
  });

  it("flags warm contact approaching threshold (70%+ of 30 days = 21+ days)", () => {
    const contact = makeContact({
      warmth: "warm",
      last_contact_date: "2026-02-15",
    });
    const result = computeCoolingContacts([contact], undefined, now);
    expect(result).toHaveLength(1);
    expect(result[0].isOverdue).toBe(false);
    expect(result[0].daysSinceLastContact).toBe(25);
  });

  it("flags hot contact as overdue after 14 days", () => {
    const contact = makeContact({
      warmth: "hot",
      last_contact_date: "2026-02-20",
    });
    const result = computeCoolingContacts([contact], undefined, now);
    expect(result).toHaveLength(1);
    expect(result[0].isOverdue).toBe(true);
    expect(result[0].threshold).toBe(14);
  });

  it("uses created_at when last_contact_date is null", () => {
    const contact = makeContact({
      warmth: "hot",
      last_contact_date: null,
      created_at: "2026-02-01T00:00:00Z",
    });
    const result = computeCoolingContacts([contact], undefined, now);
    expect(result).toHaveLength(1);
    expect(result[0].daysSinceLastContact).toBe(39);
  });

  it("respects custom thresholds", () => {
    const contact = makeContact({
      warmth: "cold",
      last_contact_date: "2026-02-01",
    });
    // Default cold threshold = 60 days, 70% = 42 days, 39 days since = not flagged
    expect(computeCoolingContacts([contact], undefined, now)).toHaveLength(0);

    // Custom threshold: cold = 30 days, 70% = 21 days, 39 days since = flagged
    const result = computeCoolingContacts([contact], { hot: 14, warm: 30, cold: 30 }, now);
    expect(result).toHaveLength(1);
    expect(result[0].isOverdue).toBe(true);
  });

  it("sorts overdue first, then by days descending", () => {
    const contacts = [
      makeContact({ name: "A", warmth: "warm", last_contact_date: "2026-02-15" }), // 25 days, not overdue (threshold 30)
      makeContact({ name: "B", warmth: "hot", last_contact_date: "2026-02-20" }),  // 20 days, overdue (threshold 14)
      makeContact({ name: "C", warmth: "hot", last_contact_date: "2026-02-25" }),  // 15 days, overdue (threshold 14)
    ];
    const result = computeCoolingContacts(contacts, undefined, now);
    expect(result.map((r) => r.contact.name)).toEqual(["B", "C", "A"]);
  });
});

// ─── computeNetworkStats ───

describe("computeNetworkStats", () => {
  const now = new Date("2026-03-12T12:00:00Z");

  it("handles empty data", () => {
    const stats = computeNetworkStats([], [], [], now);
    expect(stats.totalContacts).toBe(0);
    expect(stats.totalActions).toBe(0);
    expect(stats.totalInteractions).toBe(0);
    expect(stats.networkHealthScore).toBe(15); // only (100 - 0) * 0.15 = 15
  });

  it("computes warmth distribution correctly", () => {
    const contacts = [
      makeContact({ warmth: "hot" }),
      makeContact({ warmth: "hot" }),
      makeContact({ warmth: "warm" }),
      makeContact({ warmth: "cold" }),
    ];
    const stats = computeNetworkStats(contacts, [], [], now);
    expect(stats.warmthDistribution).toEqual({ hot: 2, warm: 1, cold: 1 });
    expect(stats.warmthPercent.hot).toBe(50);
    expect(stats.warmthPercent.warm).toBe(25);
    expect(stats.warmthPercent.cold).toBe(25);
  });

  it("computes action completion rate", () => {
    const actions = [
      makeAction({ status: "done" }),
      makeAction({ status: "done" }),
      makeAction({ status: "skipped" }),
      makeAction({ status: "pending" }),
    ];
    const stats = computeNetworkStats([], actions, [], now);
    expect(stats.actionsDone).toBe(2);
    expect(stats.actionsSkipped).toBe(1);
    expect(stats.actionsPending).toBe(1);
    expect(stats.completionRate).toBe(67); // 2/(2+1) = 67%
  });

  it("counts interactions in time windows", () => {
    const interactions = [
      makeInteraction({ created_at: "2026-03-11T10:00:00Z" }), // 1 day ago — within 7d and 30d
      makeInteraction({ created_at: "2026-03-06T10:00:00Z" }), // 6 days ago — within 7d and 30d
      makeInteraction({ created_at: "2026-02-20T10:00:00Z" }), // 20 days ago — within 30d only
      makeInteraction({ created_at: "2026-01-01T10:00:00Z" }), // 70 days ago — outside both
    ];
    const stats = computeNetworkStats([], [], interactions, now);
    expect(stats.interactionsLast7d).toBe(2);
    expect(stats.interactionsLast30d).toBe(3);
    expect(stats.totalInteractions).toBe(4);
  });

  it("computes average days since contact", () => {
    const contacts = [
      makeContact({ last_contact_date: "2026-03-02" }), // 10 days
      makeContact({ last_contact_date: "2026-02-10" }), // 30 days
    ];
    const stats = computeNetworkStats(contacts, [], [], now);
    expect(stats.averageDaysSinceContact).toBe(20);
    expect(stats.contactsNeverContacted).toBe(0);
  });

  it("counts never-contacted contacts", () => {
    const contacts = [
      makeContact({ last_contact_date: "2026-03-10" }),
      makeContact({ last_contact_date: null }),
      makeContact({ last_contact_date: null }),
    ];
    const stats = computeNetworkStats(contacts, [], [], now);
    expect(stats.contactsNeverContacted).toBe(2);
  });

  it("health score is higher with hot contacts and recent activity", () => {
    const contacts = [
      makeContact({ warmth: "hot", last_contact_date: "2026-03-10" }),
      makeContact({ warmth: "hot", last_contact_date: "2026-03-11" }),
    ];
    const actions = [makeAction({ status: "done" })];
    const interactions = [
      makeInteraction({ created_at: "2026-03-11T10:00:00Z" }),
      makeInteraction({ created_at: "2026-03-10T10:00:00Z" }),
      makeInteraction({ created_at: "2026-03-09T10:00:00Z" }),
    ];
    const stats = computeNetworkStats(contacts, actions, interactions, now);
    // hot% = 100, completion = 100%, 3 interactions * 20 = 60 activity, 0 never-contacted
    // Score = 100*0.3 + 100*0.3 + 60*0.25 + 100*0.15 = 30 + 30 + 15 + 15 = 90
    expect(stats.networkHealthScore).toBe(90);
  });

  it("health score is clamped between 0 and 100", () => {
    const stats = computeNetworkStats([], [], [], now);
    expect(stats.networkHealthScore).toBeGreaterThanOrEqual(0);
    expect(stats.networkHealthScore).toBeLessThanOrEqual(100);
  });

  it("generates 8 weekly activity entries", () => {
    const stats = computeNetworkStats([], [], [], now);
    expect(stats.weeklyActivity).toHaveLength(8);
    expect(stats.weeklyActivity[7].week).toBe("Cette sem.");
  });
});
