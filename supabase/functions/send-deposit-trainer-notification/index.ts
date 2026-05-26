import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const VERSION = "send-deposit-trainer-notification@2026-05-26.1";

/**
 * Notifies the trainer(s) of the session(s) where the learner is registered
 * when a deposit is published to the community (visibility=shared,
 * publication_status=published). Idempotent via deposits.trainer_notified_at.
 *
 * Body: { depositId: string }
 */
serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const { depositId } = body ?? {};
    if (!depositId) {
      return new Response(
        JSON.stringify({ error: "Missing depositId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load deposit
    const { data: deposit, error: depErr } = await supabase
      .from("lms_work_deposits")
      .select("id, course_id, lesson_id, learner_email, visibility, publication_status, trainer_notified_at, comment, file_name")
      .eq("id", depositId)
      .single();
    if (depErr || !deposit) {
      return new Response(
        JSON.stringify({ error: "Deposit not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only notify if community-published
    if (deposit.visibility !== "shared" || deposit.publication_status !== "published") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "not_shared_published", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotency
    if (deposit.trainer_notified_at) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_notified", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find trainings where the learner is registered AND that point to this LMS course
    const { data: participants } = await supabase
      .from("training_participants")
      .select("training_id, first_name, last_name")
      .eq("email", deposit.learner_email);

    const trainingIds = (participants || []).map((p: { training_id: string }) => p.training_id);
    if (trainingIds.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_participant_row", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: trainings } = await supabase
      .from("trainings")
      .select("id, name, trainer_id, supports_lms_course_id")
      .in("id", trainingIds)
      .eq("supports_lms_course_id", deposit.course_id);

    const trainerIds = Array.from(
      new Set(((trainings || []) as Array<{ trainer_id: string | null }>).map((t) => t.trainer_id).filter(Boolean)),
    ) as string[];

    if (trainerIds.length === 0) {
      // Mark as notified anyway so we don't retry forever
      await supabase.from("lms_work_deposits").update({ trainer_notified_at: new Date().toISOString() }).eq("id", depositId);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_trainer", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: trainers } = await supabase
      .from("trainers")
      .select("id, first_name, email")
      .in("id", trainerIds);

    const recipients = ((trainers || []) as Array<{ first_name: string | null; email: string | null }>)
      .filter((t) => !!t.email);

    if (recipients.length === 0) {
      await supabase.from("lms_work_deposits").update({ trainer_notified_at: new Date().toISOString() }).eq("id", depositId);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_trainer_email", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Course title + lesson title
    const [{ data: course }, { data: lesson }] = await Promise.all([
      supabase.from("lms_courses").select("title").eq("id", deposit.course_id).single(),
      deposit.lesson_id
        ? supabase.from("lms_lessons").select("title").eq("id", deposit.lesson_id).single()
        : Promise.resolve({ data: null as { title: string } | null }),
    ]);

    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;
    const depositLink = `${APP_URL}/lms/deposits?deposit=${encodeURIComponent(depositId)}`;

    const learnerFullName = (() => {
      const p = (participants || [])[0] as { first_name?: string; last_name?: string } | undefined;
      const fn = (p?.first_name || "").trim();
      const ln = (p?.last_name || "").trim();
      const full = `${fn} ${ln}`.trim();
      return full || deposit.learner_email;
    })();

    const senderFrom = await getSenderFrom();
    const signature = await getSigniticSignature();
    const bccList = await getBccList();

    const courseTitle = course?.title || "votre formation";
    const lessonTitle = lesson?.title ? ` (leçon « ${lesson.title} »)` : "";
    const subject = `Nouvelle publication communauté — ${courseTitle}`;

    let sent = 0;
    for (const trainer of recipients) {
      const trainerFirstName = (trainer.first_name || "").trim();
      const bodyHtml = `
        <p>Bonjour${trainerFirstName ? " " + trainerFirstName : ""},</p>
        <p><strong>${learnerFullName}</strong> vient de publier un travail dans la communauté de la formation
        <strong>${courseTitle}</strong>${lessonTitle}.</p>
        ${emailInfoBox("Vous pouvez consulter la publication, laisser un retour ou modérer les échanges.")}
        ${emailButton("Voir la publication", depositLink)}
        <p>Bonne lecture,<br>L'équipe SuperTilt</p>
      `;
      const html = wrapEmailHtml(bodyHtml, signature);

      const result = await sendEmail({
        from: senderFrom,
        to: [trainer.email as string],
        bcc: bccList,
        subject,
        html,
        _emailType: "deposit_trainer_notification",
      });
      if (result.success) sent += 1;
      // Small spacing between sends (memory: 400ms in bulk)
      await new Promise((r) => setTimeout(r, 400));
    }

    if (sent > 0) {
      await supabase
        .from("lms_work_deposits")
        .update({ trainer_notified_at: new Date().toISOString() })
        .eq("id", depositId);
    }

    return new Response(
      JSON.stringify({ success: true, sent, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-deposit-trainer-notification error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
