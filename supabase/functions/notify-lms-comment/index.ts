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

    const subject = `💬 Nouveau commentaire e-learning — ${course?.title || "Cours"}`;
    const { app_url } = await getAppUrls();
    const communityUrl = courseId && lessonId ? `${app_url}/lms/${courseId}/player?preview=admin&lesson=${lessonId}` : null;

    const html = `
      <p>Un apprenant a laissé un commentaire sur une leçon e-learning :</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px;font-weight:bold">Apprenant</td><td style="padding:4px 12px">${learnerName || learnerEmail}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Cours</td><td style="padding:4px 12px">${course?.title || courseId}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Leçon</td><td style="padding:4px 12px">${lesson?.title || lessonId}</td></tr>
      </table>
      <blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:4px">
        ${comment.replace(/\n/g, "<br>")}
      </blockquote>
      ${communityUrl ? `<p style="margin:24px 0"><a href="${communityUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500">Voir la leçon (vue staff)</a></p>` : ""}
    `;

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
