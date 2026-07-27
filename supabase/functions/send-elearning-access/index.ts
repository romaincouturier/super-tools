import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  replaceVariables,
  getSupabaseClient,
  sendEmail,
  formatDateFr,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId, couponCode } = await req.json();

    if (!participantId || !trainingId) {
      return createErrorResponse("participantId and trainingId are required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch signature
    const signature = await getSigniticSignature();

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      return createErrorResponse("Participant introuvable", 404);
    }

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return createErrorResponse("Formation introuvable", 404);
    }

    // Get email content from global template
    const isTu = !training.sponsor_formal_address;
    const templateType = isTu ? "elearning_access_tu" : "elearning_access_vous";

    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", templateType)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!template) {
      return createErrorResponse("Template d'email e-learning introuvable", 404);
    }

    let emailSubject = template.subject;
    let emailContent = template.html_content;

    // Access link = onboarding link on the SuperTilt platform (training.supertilt_link).
    // Never fall back to `training.location` — it's descriptive text (e.g. "En ligne en accédant à son compte sur supertilt.fr"),
    // which the browser Punycodes into a broken URL when used as an <a href>.
    const isHttpUrl = (v: unknown): v is string =>
      typeof v === "string" && /^https?:\/\//i.test(v.trim());
    const accessLink = isHttpUrl(training.supertilt_link)
      ? training.supertilt_link.trim()
      : "https://www.supertilt.fr";

    // Variable replacements
    const variables: Record<string, string> = {
      first_name: participant.first_name || "",
      last_name: participant.last_name || "",
      training_name: training.training_name || "",
      access_link: accessLink,
      start_date: training.start_date ? formatDateFr(training.start_date) : "",
      end_date: training.end_date ? formatDateFr(training.end_date) : (training.start_date ? formatDateFr(training.start_date) : ""),
      coupon_code: couponCode || "",
    };

    emailSubject = replaceVariables(emailSubject, variables);
    emailContent = replaceVariables(emailContent, variables);

    // Convert plain-text newlines in emailContent to HTML paragraphs/breaks
    const formatContentToHtml = (content: string): string => {
      const blocks = content.split(/\n\n+/);
      return blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^<(p|div|table|ol|ul|h[1-6])\b/i.test(trimmed)) {
          return trimmed;
        }
        const lines = trimmed.split(/\n/).map(l => l.trim()).join("<br>");
        return `<p>${lines}</p>`;
      }).filter(Boolean).join("\n");
    };

    const formattedContent = formatContentToHtml(emailContent);

    // Build HTML email
    const htmlEmail = `
      ${formattedContent}
      ${signature}
    `;

    // Send email to participant with BCC
    const bccList = await getBccList();
    const result = await sendEmail({
      to: [participant.email],
      bcc: bccList,
      subject: emailSubject,
      html: htmlEmail,
    });

    if (!result.success) {
      console.error("Failed to send e-learning access email:", result.error);
      return createErrorResponse(`Erreur d'envoi: ${result.error}`, 500);
    }

    console.log(`E-learning access email sent to ${participant.email} for training ${training.training_name}`);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "elearning_access_email_sent",
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_id: participantId,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim(),
          coupon_code: couponCode || null,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return createJsonResponse({
      success: true,
      message: `Email d'accès envoyé à ${participant.email}`,
    });
  } catch (error: unknown) {
    console.error("Error in send-elearning-access:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(errorMessage, 500);
  }
});
