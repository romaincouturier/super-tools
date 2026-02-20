import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  formatDateWithDayFr,
} from "../_shared/mod.ts";

/**
 * Send Convention Reminder
 *
 * Sends a follow-up email to remind sponsors to sign the training convention.
 * Works for both:
 * - Intra trainings (training-level convention, sent to sponsor_email)
 * - Inter/E-learning (per-participant convention, sent to participant's sponsor_email)
 */

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, participantId } = await req.json();

    if (!trainingId) {
      return createErrorResponse("trainingId is required", 400);
    }

    const supabase = getSupabaseClient();
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";

    // Fetch BCC settings and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Formation introuvable");
    }

    const formattedDate = formatDateWithDayFr(training.start_date);
    const isIntra = training.format_formation === "intra";

    let recipientEmail: string;
    let recipientFirstName: string;
    let signatureToken: string | null = null;

    if (isIntra) {
      // For intra: send to training-level sponsor
      if (!training.sponsor_email) {
        return createErrorResponse("Pas de commanditaire défini pour cette formation intra", 400);
      }

      recipientEmail = training.sponsor_email;
      recipientFirstName = training.sponsor_first_name || "";

      // Find existing signature token
      const { data: sigData } = await supabase
        .from("convention_signatures")
        .select("token, status")
        .eq("training_id", trainingId)
        .eq("recipient_email", recipientEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sigData) {
        signatureToken = sigData.token;
      }
    } else {
      // For inter/e-learning: send to participant's sponsor
      if (!participantId) {
        return createErrorResponse("participantId is required for inter/e-learning formations", 400);
      }

      const { data: participant, error: pError } = await supabase
        .from("training_participants")
        .select("*")
        .eq("id", participantId)
        .single();

      if (pError || !participant) {
        throw new Error("Participant introuvable");
      }

      if (!participant.sponsor_email) {
        return createErrorResponse("Pas de commanditaire défini pour ce participant", 400);
      }

      recipientEmail = participant.sponsor_email;
      recipientFirstName = participant.sponsor_first_name || "";

      // Find existing signature token
      const { data: sigData } = await supabase
        .from("convention_signatures")
        .select("token, status")
        .eq("training_id", trainingId)
        .eq("recipient_email", recipientEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sigData) {
        signatureToken = sigData.token;
      }
    }

    // Build signature URL if token exists
    const signatureUrl = signatureToken ? `${appUrl}/signature-convention/${signatureToken}` : "";

    // Fetch custom template
    const useFormal = isIntra ? training.sponsor_formal_address : true;
    const templateType = useFormal ? "convention_reminder_vous" : "convention_reminder_tu";

    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", templateType)
      .eq("is_default", true)
      .maybeSingle();

    // Build the email content
    const greeting = recipientFirstName
      ? (useFormal ? `Bonjour ${recipientFirstName},` : `Bonjour ${recipientFirstName},`)
      : "Bonjour,";

    let subject: string;
    let htmlBody: string;

    if (template?.subject && template?.html_content) {
      subject = template.subject;
      htmlBody = template.html_content;

      // Replace variables
      const replacements: Record<string, string> = {
        "{{first_name}}": recipientFirstName,
        "{{training_name}}": training.training_name,
        "{{training_date}}": formattedDate,
        "{{signature_link}}": signatureUrl,
      };

      for (const [key, value] of Object.entries(replacements)) {
        subject = subject.replaceAll(key, value);
        htmlBody = htmlBody.replaceAll(key, value);
      }

      // Process conditional signature block
      if (signatureUrl) {
        const signatureLinkRegex = /\{\{#signature_link\}\}([\s\S]*?)\{\{\/signature_link\}\}/g;
        htmlBody = htmlBody.replace(signatureLinkRegex, "$1");
      } else {
        const signatureLinkRegex = /\{\{#signature_link\}\}[\s\S]*?\{\{\/signature_link\}\}/g;
        htmlBody = htmlBody.replace(signatureLinkRegex, "");
      }
    } else {
      // Default template
      subject = useFormal
        ? `Rappel : convention de formation "${training.training_name}"`
        : `Rappel : convention de formation "${training.training_name}"`;

      const signatureBlock = signatureUrl
        ? `
<p style="margin: 24px 0;">
  <a href="${signatureUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
    ✍️ Signer la convention en ligne
  </a>
</p>`
        : "";

      if (useFormal) {
        htmlBody = `
<p>${greeting}</p>
<p>Je me permets de vous relancer au sujet de la <strong>convention de formation</strong> pour la formation <strong>"${training.training_name}"</strong> prévue le <strong>${formattedDate}</strong>.</p>
<p>Pourriez-vous nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?</p>
${signatureBlock}
<p>Je reste à votre disposition pour toute question.</p>
<p>Bien cordialement,</p>`;
      } else {
        htmlBody = `
<p>${greeting}</p>
<p>Je me permets de te relancer au sujet de la <strong>convention de formation</strong> pour la formation <strong>"${training.training_name}"</strong> prévue le <strong>${formattedDate}</strong>.</p>
<p>Peux-tu nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?</p>
${signatureBlock}
<p>N'hésite pas si tu as des questions !</p>
<p>À bientôt,</p>`;
      }
    }

    // Send email
    const fullHtml = `${htmlBody}${signature}`;
    const result = await sendEmail({
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: fullHtml,
    });

    if (!result.success) {
      throw new Error(`Échec de l'envoi de l'email: ${result.error}`);
    }

    console.log("Convention reminder sent to:", recipientEmail, result);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_reminder_sent",
        recipient_email: recipientEmail,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_id: participantId || null,
          format_formation: training.format_formation,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error sending convention reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send convention reminder";
    return createErrorResponse(errorMessage);
  }
});
