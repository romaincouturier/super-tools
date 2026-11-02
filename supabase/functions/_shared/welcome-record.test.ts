import { describe, expect, it } from "vitest";
import { recordWelcome } from "./welcome-record.ts";

type Op = { op: string; table: string; values?: Record<string, unknown>; id?: unknown };

function fakeSupabase(pendingId: string | null) {
  const ops: Op[] = [];
  const client = {
    ops,
    from(table: string) {
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: pendingId ? { id: pendingId } : null, error: null }),
          };
          return chain;
        },
        update: (values: Record<string, unknown>) => ({
          eq: async (_col: string, id: unknown) => {
            ops.push({ op: "update", table, values, id });
            return { error: null };
          },
        }),
        insert: async (values: Record<string, unknown>) => {
          ops.push({ op: "insert", table, values });
          return { error: null };
        },
      };
    },
  };
  return client;
}

describe("recordWelcome", () => {
  it("solde la convocation programmée encore en attente, avec la date réelle d'envoi", async () => {
    const db = fakeSupabase("sched-1");
    await recordWelcome(db, "t1", "p1", { sent: true });
    expect(db.ops).toHaveLength(1);
    expect(db.ops[0]).toMatchObject({ op: "update", table: "scheduled_emails", id: "sched-1", values: { status: "sent", error_message: null } });
    expect(typeof db.ops[0].values?.sent_at).toBe("string");
  });

  it("trace un envoi immédiat sans convocation programmée", async () => {
    const db = fakeSupabase(null);
    await recordWelcome(db, "t1", "p1", { sent: true });
    expect(db.ops[0]).toMatchObject({
      op: "insert",
      values: { training_id: "t1", participant_id: "p1", email_type: "welcome", status: "sent" },
    });
  });

  it("trace un échec sans toucher à une convocation programmée", async () => {
    const db = fakeSupabase("sched-1");
    await recordWelcome(db, "t1", "p1", { sent: false, error: "Resend 422" });
    expect(db.ops).toEqual([
      expect.objectContaining({
        op: "insert",
        values: expect.objectContaining({ status: "failed", sent_at: null, error_message: "Resend 422", email_type: "welcome" }),
      }),
    ]);
  });
});
