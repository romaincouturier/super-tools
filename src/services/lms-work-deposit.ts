/**
 * Service layer for the "Dépôt de travail" feature (ST-2026-0043).
 *
 * Anonymous learners go through createLearnerClient(email) so the
 * x-learner-email header is set and RLS can match get_learner_email().
 * Authenticated SuperTilt uses the regular `supabase` client.
 *
 * The new tables (lms_work_deposits, lms_deposit_comments,
 * lms_deposit_feedback) are not yet in the generated Database type, so
 * the from() calls are cast at this boundary.
 */
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";
import type {
  WorkDeposit,
  DepositComment,
  DepositFeedback,
  CreateWorkDepositInput,
  UpdateWorkDepositInput,
} from "@/types/lms-work-deposit";

/** Pick the right client given the learner context (anon learner vs authenticated SuperTilt). */
function clientFor(learnerEmail?: string | null) {
  if (learnerEmail) return createLearnerClient(learnerEmail);
  return supabase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deposits = (c: any) => c.from("lms_work_deposits");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comments = (c: any) => c.from("lms_deposit_comments");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedbacks = (c: any) => c.from("lms_deposit_feedback");

// ── Deposits ────────────────────────────────────────────────────────

/** Returns the learner's own deposit on a given lesson, if any. */
export async function fetchMyDeposit(lessonId: string, learnerEmail: string): Promise<WorkDeposit | null> {
  const c = clientFor(learnerEmail);
  const { data, error } = await deposits(c)
    .select("*")
    .eq("lesson_id", lessonId)
    .eq("learner_email", learnerEmail)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WorkDeposit | null;
}

/**
 * Returns the deposits visible to the learner on a given lesson:
 * their own (any visibility) plus everyone else's shared+published.
 */
export async function fetchVisibleDeposits(lessonId: string, learnerEmail: string): Promise<WorkDeposit[]> {
  const c = clientFor(learnerEmail);
  const { data, error } = await deposits(c)
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as WorkDeposit[]).filter((d) =>
    d.learner_email === learnerEmail
      ? true
      : d.visibility === "shared" && d.publication_status === "published",
  );
}

export async function createDeposit(input: CreateWorkDepositInput): Promise<WorkDeposit> {
  const c = clientFor(input.learner_email);
  const { data, error } = await deposits(c).insert(input).select().single();
  if (error) throw error;
  return data as WorkDeposit;
}

export async function updateDeposit(
  id: string,
  updates: UpdateWorkDepositInput,
  learnerEmail: string,
): Promise<WorkDeposit> {
  const c = clientFor(learnerEmail);
  const { data, error } = await deposits(c).update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as WorkDeposit;
}

export async function deleteDeposit(id: string, learnerEmail: string): Promise<void> {
  const c = clientFor(learnerEmail);
  const { error } = await deposits(c).delete().eq("id", id);
  if (error) throw error;
}

// ── Storage ─────────────────────────────────────────────────────────

/** Uploads a deposit file to the lms-content bucket and returns the public URL. */
export async function uploadDepositFile(
  file: File,
  lessonId: string,
  learnerEmail: string,
): Promise<{ url: string; name: string; size: number; mime: string }> {
  const c = clientFor(learnerEmail);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const path = `deposits/${lessonId}/${learnerEmail}/${Date.now()}_${safeName}`;
  const mime = resolveContentType(file);
  const { error } = await c.storage
    .from("lms-content")
    .upload(path, file, { contentType: mime, upsert: true });
  if (error) throw error;
  const { data } = c.storage.from("lms-content").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size, mime };
}

// ── Comments (Stage 2 surface) ──────────────────────────────────────

export async function fetchDepositComments(depositId: string, learnerEmail: string): Promise<DepositComment[]> {
  const c = clientFor(learnerEmail);
  const { data, error } = await comments(c)
    .select("*")
    .eq("deposit_id", depositId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as DepositComment[];
}

export async function createDepositComment(
  depositId: string,
  authorEmail: string,
  content: string,
): Promise<DepositComment> {
  const c = clientFor(authorEmail);
  const { data, error } = await comments(c)
    .insert({ deposit_id: depositId, author_email: authorEmail, content })
    .select()
    .single();
  if (error) throw error;
  return data as DepositComment;
}

export async function updateDepositComment(
  id: string,
  authorEmail: string,
  content: string,
): Promise<DepositComment> {
  const c = clientFor(authorEmail);
  const { data, error } = await comments(c).update({ content }).eq("id", id).select().single();
  if (error) throw error;
  return data as DepositComment;
}

export async function deleteDepositComment(id: string, authorEmail: string): Promise<void> {
  const c = clientFor(authorEmail);
  const { error } = await comments(c).delete().eq("id", id);
  if (error) throw error;
}

// ── Feedback (Stage 3 surface) ──────────────────────────────────────

export async function fetchDepositFeedback(depositId: string, learnerEmail: string): Promise<DepositFeedback[]> {
  const c = clientFor(learnerEmail);
  const { data, error } = await feedbacks(c)
    .select("*")
    .eq("deposit_id", depositId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DepositFeedback[];
}
