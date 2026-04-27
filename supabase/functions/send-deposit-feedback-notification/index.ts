import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const VERSION = "send-deposit-feedback-notification@2026-04-27.1";

/**
 * Sends an email to the learner who owns a work deposit when SuperTilt
 * publishes a feedback on it (ST-2026-0043 — Stage 3).
 *
 * Body: { depositId: string, feedbackId: string }
 * Reads the deposit + feedback rows server-side to avoid trusting the
 * client with the email address and feedback content.
 */
serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const { depositId, feedbackId } = body ?? {};
    if (!depositId || !feedbackId) {
      return new Response(
        JSON.stringify({ error: "Missing depositId or feedbackId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load deposit
    const { data: deposit, error: depErr } = await supabase
      .from("lms_work_deposits")
      .select("id, lesson_id, course_id, learner_email")
      .eq("id", depositId)
      .single();
    if (depErr || !deposit) {
      console.error("deposit lookup failed", depErr);
      return new Response(
        JSON.stringify({ error: "Deposit not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load course title
    const { data: course } = await supabase
      .from("lms_courses")
      .select("title")
      .eq("id", deposit.course_id)
      .single();

    // Build link with the learner's email so the player auto-loads them
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;
    const lessonLink = `${APP_URL}/lms/${deposit.course_id}/player?email=${encodeURIComponent(deposit.learner_email)}`;

    // Pull a first-name guess from the email local part
    const firstName = (deposit.learner_email || "").split("@")[0].split(/[._-]/)[0] || "";
    const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

    const senderFrom = await getSenderFrom();
    const signature = await getSigniticSignature();
    const bccList = await getBccList();

    const subject = "Un retour SuperTilt est disponible sur votre travail";
    const courseTitle = course?.title || "votre formation";
    const bodyHtml = `
      <p>Bonjour${displayName ? " " + displayName : ""},</p>
      <p>Un retour SuperTilt est disponible sur le travail que vous avez déposé dans la formation
      <strong>${courseTitle}</strong>.</p>
      ${emailInfoBox("Vous pouvez le consulter en cliquant sur le bouton ci-dessous.")}
      ${emailButton("Voir mon retour", lessonLink)}
      <p>À bientôt,<br>L'équipe SuperTilt</p>
    `;
    const html = wrapEmailHtml(bodyHtml, signature);

    const result = await sendEmail({
      from: senderFrom,
      to: [deposit.learner_email],
      bcc: bccList,
      subject,
      html,
      _emailType: "deposit_feedback_notification",
    });

    if (!result.success) {
      console.error("sendEmail failed", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark feedback row as notified
    await supabase
      .from("lms_deposit_feedback")
      .update({ email_sent: true })
      .eq("id", feedbackId);

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-deposit-feedback-notification error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
