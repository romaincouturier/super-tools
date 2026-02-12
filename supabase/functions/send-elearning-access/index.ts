import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  replaceVariables,
  getSupabaseClient,
  sendEmail,
  escapeHtml,
} from "../_shared/mod.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId } = await req.json();

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

    // Get email content: use training-specific content or fetch template from DB
    let emailSubject: string;
    let emailContent: string;

    const isTu = !training.sponsor_formal_address;
    const templateType = isTu ? "elearning_access_tu" : "elearning_access_vous";

    if (training.elearning_access_email_content) {
      // Use the custom content stored on the training
      emailContent = training.elearning_access_email_content;
      // Fetch subject from template
      const { data: template } = await supabase
        .from("email_templates")
        .select("subject")
        .eq("template_type", templateType)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      emailSubject = template?.subject || `Accès à la formation e-learning "${training.training_name}"`;
    } else {
      // Fetch full template
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

      emailSubject = template.subject;
      emailContent = template.html_content;
    }

    // Format dates
    const formatDateFr = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    };

    // Build access link from supertilt_link or location
    const accessLink = training.supertilt_link || training.location || "";

    // Variable replacements
    const variables: Record<string, string> = {
      first_name: participant.first_name || "",
      last_name: participant.last_name || "",
      training_name: training.training_name || "",
      access_link: accessLink,
      start_date: formatDateFr(training.start_date),
      end_date: formatDateFr(training.end_date || training.start_date),
    };

    emailSubject = replaceVariables(emailSubject, variables);
    emailContent = replaceVariables(emailContent, variables);

    // Build HTML email
    const htmlEmail = `
      ${emailContent}
      ${signature}
    `;

    // Send email to participant with BCC to romain@supertilt.fr
    const result = await sendEmail({
      to: [participant.email],
      bcc: ["romain@supertilt.fr"],
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
