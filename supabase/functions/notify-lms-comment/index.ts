import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
  sendEmail,
} from "../_shared/mod.ts";
import { getSenderEmail, getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { renderEditableEmail } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { escapeHtml } from "../_shared/resend.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Require authentication to prevent notification spam and learner impersonation.
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Authentification requise", 401);

    const { lessonId, courseId, learnerEmail, learnerName, comment } = await req.json();

    if (!lessonId || !comment) {
      return createErrorResponse("lessonId and comment are required", 400);
    }

    // Prevent impersonation: the learner email in the payload must match the JWT.
    if (learnerEmail && learnerEmail.toLowerCase() !== authResult.email?.toLowerCase()) {
      return createErrorResponse("Accès refusé", 403);
    }

    const supabase = getSupabaseClient();

    // Fetch lesson and course info
    const { data: lesson } = await supabase
      .from("lms_lessons")
      .select("title")
      .eq("id", lessonId)
      .maybeSingle();

    const { data: course } = await supabase
      .from("lms_courses")
      .select("title")
      .eq("id", courseId)
      .maybeSingle();

    // Get admin email from sender settings
    const adminEmail = await getSenderEmail();
    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    const { app_url } = await getAppUrls();
    const communityUrl = courseId ? `${app_url}/lms/communautes/${courseId}` : null;
    const tpl = EDITABLE_EMAIL_DEFAULTS.lms_comment_notification;
    const { subject, html } = await renderEditableEmail(supabase, {
      type: "lms_comment_notification",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: {
        learner_name: learnerName || learnerEmail,
        course_title: course?.title || courseId || "Cours",
        lesson_title: lesson?.title || lessonId,
      },
      blocks: {
        comment_block: `<blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:4px">${escapeHtml(String(comment)).replace(/\n/g, "<br>")}</blockquote>`,
        community_button: communityUrl ? `<p style="margin:24px 0"><a href="${communityUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500">Voir la communauté (vue staff)</a></p>` : "",
      },
    });

    const result = await sendEmail({
      from: senderFrom,
      to: [adminEmail],
      bcc: bccList,
      subject,
      html,
    });

    if (!result.success) {
      console.error("Failed to send comment notification:", result.error);
      return createErrorResponse(`Erreur d'envoi: ${result.error}`, 500);
    }

    console.log(`LMS comment notification sent to ${adminEmail} for lesson ${lesson?.title}`);

    return createJsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("Error in notify-lms-comment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(errorMessage, 500);
  }
});
