import { describe, expect, it } from "vitest";
import { summarizeLearnerAccessJobs } from "./learner-access-batch";

const row = (status: string, result_kind: string | null, account_created = false, error_message: string | null = null) =>
  ({ email: `${status}-${result_kind}@x.fr`, status, result_kind, account_created, error_message });

describe("bilan d'un lot d'emails d'accès", () => {
  it("compte comptes créés, accès confirmés, invitations et échecs", () => {
    const s = summarizeLearnerAccessJobs([
      row("sent", "create_password", true),
      row("sent", "course_access"),
      row("sent", "create_password"),
      row("failed", null, false, "Quota interne atteint"),
    ]);
    expect(s).toMatchObject({ total: 4, completed: 4, finished: true, created: 1, confirmed: 1, passwordInvites: 1 });
    expect(s.failures).toEqual([{ email: "failed-null@x.fr", message: "Quota interne atteint" }]);
  });

  it("n'est pas terminé tant qu'un envoi est en attente ou en cours", () => {
    expect(summarizeLearnerAccessJobs([row("sent", "course_access"), row("processing", null)]).finished).toBe(false);
    expect(summarizeLearnerAccessJobs([]).finished).toBe(false);
  });
});
