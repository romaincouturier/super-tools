import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { readyGroups, depositPreviewHtml, escapeHtml, type PendingDeposit, type DepositGroup } from "./digest.ts";

const VERSION = "send-deposit-trainer-notification@2026-10-05.1";
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;

/**
 * Notification formateur des publications communauté.
 *
 * - Body { depositId } (appel client à la publication) : met la publication
 *   en file (trainer_notify_requested_at). Aucun mail immédiat.
 * - Body { mode: "flush" } (cron 5 min) : envoie un mail par groupe
 *   (apprenant, formation) dont la dernière publication a >= 5 min, avec
 *   aperçu et lien « J'aime » tokenisé. Idempotent via trainer_notified_at.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ ...(body as object), _version: VERSION }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body?.mode === "flush") return json(await flush(supabase));

    const depositId = body?.depositId;
    if (!depositId || typeof depositId !== "string") return json({ error: "Missing depositId" }, 400);

    const { data: deposit } = await supabase
      .from("lms_work_deposits")
      .select("id, visibility, publication_status, trainer_notified_at, trainer_notify_requested_at")
      .eq("id", depositId)
      .maybeSingle();
    if (!deposit) return json({ error: "Deposit not found" }, 404);
    if (deposit.visibility !== "shared" || deposit.publication_status !== "published") {
      return json({ skipped: true, reason: "not_shared_published" });
    }
    if (deposit.trainer_notified_at) return json({ skipped: true, reason: "already_notified" });
    if (!deposit.trainer_notify_requested_at) {
      await supabase
        .from("lms_work_deposits")
        .update({ trainer_notify_requested_at: new Date().toISOString() })
        .eq("id", depositId)
        .is("trainer_notify_requested_at", null);
    }
    return json({ queued: true });
  } catch (err) {
    console.error("send-deposit-trainer-notification error", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function flush(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("lms_work_deposits")
    .select("id, course_id, lesson_id, learner_email, comment, file_url, file_mime, file_name, trainer_notify_requested_at, visibility, publication_status")
    .is("trainer_notified_at", null)
    .not("trainer_notify_requested_at", "is", null)
    .gte("trainer_notify_requested_at", since);
  if (error) throw error;

  // Publications masquées/supprimées entre-temps : on ne les annonce pas.
  const live = (pending || []).filter(
    (d: { visibility: string; publication_status: string }) => d.visibility === "shared" && d.publication_status === "published",
  ) as PendingDeposit[];
  const groups = readyGroups(live, Date.now());
  if (groups.length === 0) return { success: true, groups: 0 };

  const [senderFrom, signature, bccList, { getAppUrls }] = await Promise.all([
    getSenderFrom(), getSigniticSignature(), getBccList(), import("../_shared/app-urls.ts"),
  ]);
  const APP_URL = (await getAppUrls()).app_url;
  const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/deposit-email-reaction`;

  let sent = 0;
  for (const group of groups) {
    sent += await sendGroup(supabase, group, { senderFrom, signature, bccList, APP_URL, FN_URL });
  }
  return { success: true, groups: groups.length, sent };
}

async function markNotified(supabase: SupabaseClient, ids: string[]) {
  await supabase.from("lms_work_deposits").update({ trainer_notified_at: new Date().toISOString() }).in("id", ids);
}

async function sendGroup(
  supabase: SupabaseClient,
  group: DepositGroup,
  ctx: { senderFrom: string; signature: string; bccList: string[]; APP_URL: string; FN_URL: string },
): Promise<number> {
  const ids = group.deposits.map((d) => d.id);

  const { data: participants } = await supabase
    .from("training_participants")
    .select("training_id, first_name, last_name")
    .ilike("email", group.learner_email);
  const trainingIds = (participants || []).map((p: { training_id: string }) => p.training_id);
  if (trainingIds.length === 0) { await markNotified(supabase, ids); return 0; }

  const { data: trainings } = await supabase
    .from("trainings")
    .select("trainer_id")
    .in("id", trainingIds)
    .eq("supports_lms_course_id", group.course_id);
  const trainerIds = Array.from(new Set((trainings || []).map((t: { trainer_id: string | null }) => t.trainer_id).filter(Boolean))) as string[];
  if (trainerIds.length === 0) { await markNotified(supabase, ids); return 0; }

  const { data: trainers } = await supabase.from("trainers").select("first_name, email").in("id", trainerIds);
  const recipients = ((trainers || []) as Array<{ first_name: string | null; email: string | null }>).filter((t) => !!t.email);
  if (recipients.length === 0) { await markNotified(supabase, ids); return 0; }

  const lessonIds = Array.from(new Set(group.deposits.map((d) => d.lesson_id).filter(Boolean))) as string[];
  const [{ data: course }, { data: lessons }] = await Promise.all([
    supabase.from("lms_courses").select("title").eq("id", group.course_id).maybeSingle(),
    lessonIds.length
      ? supabase.from("lms_lessons").select("id, title").in("id", lessonIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);
  const lessonTitle = new Map((lessons || []).map((l: { id: string; title: string }) => [l.id, l.title]));

  const p = (participants || [])[0] as { first_name?: string; last_name?: string } | undefined;
  const learnerName = `${(p?.first_name || "").trim()} ${(p?.last_name || "").trim()}`.trim() || group.learner_email;
  const courseTitle = course?.title || "votre formation";
  const n = group.deposits.length;
  const subject = n > 1
    ? `${n} nouvelles publications communauté — ${courseTitle}`
    : `Nouvelle publication communauté — ${courseTitle}`;

  let sent = 0;
  for (const trainer of recipients) {
    const trainerEmail = (trainer.email as string).toLowerCase();
    const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const tokens = group.deposits.map((d) => ({ token: randomToken(), deposit_id: d.id, trainer_email: trainerEmail, expires_at: expires }));
    const { error: tokErr } = await supabase.from("deposit_reaction_tokens").insert(tokens);
    if (tokErr) console.warn("deposit_reaction_tokens insert failed:", tokErr);

    const previews = group.deposits.map((d, i) =>
      depositPreviewHtml({
        deposit: d,
        lessonTitle: d.lesson_id ? lessonTitle.get(d.lesson_id) ?? null : null,
        viewUrl: `${ctx.APP_URL}/lms/deposits?deposit=${encodeURIComponent(d.id)}`,
        likeUrl: tokErr ? `${ctx.APP_URL}/lms/deposits?deposit=${encodeURIComponent(d.id)}` : `${ctx.FN_URL}?t=${tokens[i].token}`,
      })
    ).join("");

    const firstName = (trainer.first_name || "").trim();
    const intro = n > 1
      ? `vient de publier <strong>${n} travaux</strong> dans la communauté de la formation`
      : "vient de publier un travail dans la communauté de la formation";
    const html = wrapEmailHtml(`
      <p>Bonjour${firstName ? " " + escapeHtml(firstName) : ""},</p>
      <p><strong>${escapeHtml(learnerName)}</strong> ${intro} <strong>${escapeHtml(courseTitle)}</strong>.</p>
      ${previews}
      <p style="color:#6b7280;font-size:13px">« J'aime » enregistre votre réaction directement, sans vous reconnecter.</p>
      <p>Bonne lecture,<br>L'équipe SuperTilt</p>
    `, ctx.signature);

    const result = await sendEmail({
      from: ctx.senderFrom,
      to: [trainerEmail],
      bcc: ctx.bccList,
      subject,
      html,
      _emailType: "deposit_trainer_notification",
    });
    if (result.success) sent += 1;
    await new Promise((r) => setTimeout(r, 400));
  }

  if (sent > 0) await markNotified(supabase, ids);
  return sent;
}
