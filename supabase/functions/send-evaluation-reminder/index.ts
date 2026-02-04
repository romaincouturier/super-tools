import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  processTemplate,
  textToHtml,
} from "../_shared/index.ts";

// Default templates - Reminder 1
const DEFAULT_SUBJECT_REMINDER_1_TU = "📝 Petit rappel : ton avis compte pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_1_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour ta contribution !

Belle journée à toi`;

const DEFAULT_SUBJECT_REMINDER_1_VOUS = "📝 Petit rappel : votre avis compte pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_1_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour votre contribution !

Belle journée à vous`;

// Default templates - Reminder 2
const DEFAULT_SUBJECT_REMINDER_2_TU = "🙏 Dernière relance : ta contribution pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_2_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers toi une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !

Si tu as 2 minutes, voici le lien :
{{evaluation_link}}

Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !

À bientôt`;

const DEFAULT_SUBJECT_REMINDER_2_VOUS = "🙏 Dernière relance : votre contribution pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_2_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers vous une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !

Si vous avez 2 minutes, voici le lien :
{{evaluation_link}}

Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !

À bientôt`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { scheduledEmailId } = await req.json();

    if (!scheduledEmailId) {
      return createErrorResponse("scheduledEmailId is required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch the scheduled email
    const { data: scheduledEmail, error: scheduledError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("id", scheduledEmailId)
      .single();

    if (scheduledError || !scheduledEmail) {
      throw new Error("Scheduled email not found");
    }

    if (scheduledEmail.status !== "pending") {
      return createJsonResponse({ success: true, message: "Email already processed", status: scheduledEmail.status });
    }

    const isReminder1 = scheduledEmail.email_type === "evaluation_reminder_1";
    const isReminder2 = scheduledEmail.email_type === "evaluation_reminder_2";

    if (!isReminder1 && !isReminder2) {
      return createErrorResponse("This function only handles evaluation reminders", 400);
    }

    const trainingId = scheduledEmail.training_id;
    const participantId = scheduledEmail.participant_id;

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    // Check if the participant has already submitted their evaluation
    const { data: evaluation } = await supabase
      .from("training_evaluations")
      .select("id, etat, token")
      .eq("training_id", trainingId)
      .eq("participant_id", participantId)
      .single();

    // If evaluation exists and is submitted, cancel this reminder
    if (evaluation && evaluation.etat === "soumis") {
      console.log(`Participant ${participant.email} has already submitted evaluation, cancelling reminder`);

      await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", error_message: "Évaluation déjà soumise" })
        .eq("id", scheduledEmailId);

      return createJsonResponse({ success: true, message: "Reminder cancelled - evaluation already submitted" });
    }

    // If no evaluation record exists, we can't send a reminder (no token)
    if (!evaluation) {
      console.log(`No evaluation record for participant ${participant.email}, cancelling reminder`);

      await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", error_message: "Aucune évaluation créée pour ce participant" })
        .eq("id", scheduledEmailId);

      return createJsonResponse({ success: true, message: "Reminder cancelled - no evaluation record" });
    }

    // Determine if we should use tutoiement or vouvoiement
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = isReminder1 ? "evaluation_reminder_1" : "evaluation_reminder_2";

    // Fetch custom email template if exists
    const { data: customTemplate } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `${templateType}${templateTypeSuffix}`)
      .single();

    // Use appropriate default based on reminder type and formality setting
    let defaultSubject: string;
    let defaultContent: string;

    if (isReminder1) {
      defaultSubject = useTutoiement ? DEFAULT_SUBJECT_REMINDER_1_TU : DEFAULT_SUBJECT_REMINDER_1_VOUS;
      defaultContent = useTutoiement ? DEFAULT_CONTENT_REMINDER_1_TU : DEFAULT_CONTENT_REMINDER_1_VOUS;
    } else {
      defaultSubject = useTutoiement ? DEFAULT_SUBJECT_REMINDER_2_TU : DEFAULT_SUBJECT_REMINDER_2_VOUS;
      defaultContent = useTutoiement ? DEFAULT_CONTENT_REMINDER_2_TU : DEFAULT_CONTENT_REMINDER_2_VOUS;
    }

    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Fetch BCC settings and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

    // Build evaluation link
    const baseUrl = "https://super-tools.lovable.app";
    const evaluationLink = `${baseUrl}/evaluation/${evaluation.token}`;

    // Process templates with variables (don't escape - templates contain the content)
    const variables = {
      first_name: participant.first_name,
      training_name: training.training_name,
      evaluation_link: evaluationLink,
    };

    const subject = processTemplate(subjectTemplate, variables, false);
    const contentText = processTemplate(contentTemplate, variables, false);
    const contentHtml = textToHtml(contentText);

    const htmlContent = `
      ${contentHtml}
      ${signature}
    `;

    console.log(`Sending ${templateType} to:`, participant.email);

    const result = await sendEmail({
      to: [participant.email],
      bcc: bccList,
      subject,
      html: htmlContent,
    });

    if (!result.success) {
      // Mark as failed
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error_message: result.error })
        .eq("id", scheduledEmailId);

      throw new Error(`Failed to send email: ${result.error}`);
    }

    // Mark as sent
    await supabase
      .from("scheduled_emails")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", scheduledEmailId);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: `${templateType}_sent`,
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
          email_subject: subject,
          email_content: contentText,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    console.log(`${templateType} sent successfully to ${participant.email}`);

    return createJsonResponse({ success: true, email: participant.email });
  } catch (error: unknown) {
    console.error("Error sending evaluation reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send evaluation reminder";
    return createErrorResponse(errorMessage);
  }
});
