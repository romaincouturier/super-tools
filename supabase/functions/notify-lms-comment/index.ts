import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  sendEmail,
} from "../_shared/mod.ts";
import { getSenderInfo, getBccList } from "../_shared/email-settings.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { lessonId, courseId, learnerEmail, learnerName, comment } = await req.json();

    if (!lessonId || !comment) {
      return createErrorResponse("lessonId and comment are required", 400);
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
    const sender = await getSenderInfo();
    const adminEmail = sender.email;

    const subject = `💬 Nouveau commentaire e-learning — ${course?.title || "Cours"}`;
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
    `;

    const result = await sendEmail({
      to: [adminEmail],
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
