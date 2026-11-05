export type LearnerAccessJobRow = {
  email: string;
  status: string;
  result_kind: string | null;
  account_created: boolean;
  error_message: string | null;
};

const ACCESS_KINDS = new Set(["course_access", "space_access"]);

/** Bilan d'un lot d'emails d'accès : un mail par personne, échecs conservés. */
export function summarizeLearnerAccessJobs(rows: LearnerAccessJobRow[]) {
  const sent = rows.filter((r) => r.status === "sent");
  const failed = rows.filter((r) => r.status === "failed");
  const completed = sent.length + failed.length;
  return {
    total: rows.length,
    completed,
    finished: rows.length > 0 && completed === rows.length,
    created: sent.filter((r) => r.account_created).length,
    confirmed: sent.filter((r) => !r.account_created && ACCESS_KINDS.has(r.result_kind ?? "")).length,
    passwordInvites: sent.filter((r) => !r.account_created && !ACCESS_KINDS.has(r.result_kind ?? "")).length,
    failures: failed.map((r) => ({ email: r.email, message: r.error_message ?? "Erreur inconnue" })),
  };
}
