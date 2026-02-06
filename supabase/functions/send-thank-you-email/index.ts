import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { randomBytes, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";
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
} from "../_shared/mod.ts";

// Generate a secure token for evaluation access
function generateEvaluationToken(): string {
  const uuid = crypto.randomUUID();
  const randomPart = randomBytes(8).toString("hex");
  const hash = createHash("sha256").update(uuid + randomPart).digest("hex").slice(0, 16);
  return `${uuid}-${hash}`;
}

// Default template content - Tutoiement version
const DEFAULT_SUBJECT_TU = "Merci pour ta participation à la formation {{training_name}}";
const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ton énergie et ta participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que tu prennes quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Tu trouveras également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans tes présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment tu vas utiliser tout ce que nous avons vu ! N'hésite pas à me contacter si tu as des questions ou des besoins de compléments d'informations.

Je te souhaite une bonne journée`;

// Default template content - Vouvoiement version
const DEFAULT_SUBJECT_VOUS = "Merci pour votre participation à la formation {{training_name}}";
const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée`;

// Helper function to add N working days to a date
function addWorkingDays(startDate: Date, numDays: number, workingDays: boolean[]): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  const maxIterations = numDays * 3; // Safety limit
  let iterations = 0;

  while (daysAdded < numDays && iterations < maxIterations) {
    result.setDate(result.getDate() + 1);
    iterations++;
    if (workingDays[result.getDay()]) {
      daysAdded++;
    }
  }

  return result;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, testEmail } = await req.json();

    if (!trainingId) {
      return createErrorResponse("trainingId is required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Determine if we should use tutoiement or vouvoiement
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";

    // Fetch custom email template if exists (with mode suffix)
    const { data: customTemplate } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `thank_you${templateTypeSuffix}`)
      .single();

    // Use appropriate default based on formality setting
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;

    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Fetch BCC settings and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

    const trainingName = training.training_name;
    const supportsUrl = training.supports_url || "";

    // Base URL for evaluation links
    const baseUrl = "https://super-tools.lovable.app";

    // TEST MODE: Send only to the test email
    if (testEmail) {
      console.log("Sending TEST email to:", testEmail);

      const variables = {
        first_name: "Test",
        training_name: trainingName,
        evaluation_link: `${baseUrl}/evaluation/test-token-preview`,
        supports_url: supportsUrl,
      };

      const subject = `[TEST] ${processTemplate(subjectTemplate, variables, false)}`;
      const contentText = processTemplate(contentTemplate, variables, false);
      const contentHtml = textToHtml(contentText);

      const htmlContent = `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-bottom: 20px; border-radius: 4px;">
          <strong>⚠️ Ceci est un email de test</strong><br/>
          Le lien d'évaluation ci-dessous est un exemple et ne fonctionne pas.
        </div>
        ${contentHtml}
        ${signature}
      `;

      const result = await sendEmail({
        to: [testEmail],
        subject,
        html: htmlContent,
      });

      if (!result.success) {
        throw new Error(`Failed to send test email: ${result.error}`);
      }

      return createJsonResponse({ success: true, testEmail });
    }

    // PRODUCTION MODE: Send to all participants
    const { data: participants, error: participantsError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", trainingId);

    if (participantsError || !participants || participants.length === 0) {
      throw new Error("No participants found for this training");
    }

    // Create evaluations and send individual emails to each participant sequentially
    const results: { email: string; success: boolean }[] = [];

    for (const participant of participants) {
      // Check if evaluation already exists
      const { data: existingEval } = await supabase
        .from("training_evaluations")
        .select("id, token")
        .eq("participant_id", participant.id)
        .eq("training_id", trainingId)
        .single();

      let evaluationToken: string;

      if (existingEval) {
        evaluationToken = existingEval.token;
      } else {
        // Create a new evaluation record
        evaluationToken = generateEvaluationToken();

        const { error: evalError } = await supabase
          .from("training_evaluations")
          .insert({
            training_id: trainingId,
            participant_id: participant.id,
            token: evaluationToken,
            email: participant.email,
            first_name: participant.first_name,
            last_name: participant.last_name,
            company: participant.company,
            etat: "envoye",
            date_envoi: new Date().toISOString(),
          });

        if (evalError) {
          console.error("Failed to create evaluation for", participant.email, evalError);
          throw evalError;
        }
      }

      const evaluationLink = `${baseUrl}/evaluation/${evaluationToken}`;

      // Process templates with variables
      const variables = {
        first_name: participant.first_name,
        training_name: trainingName,
        evaluation_link: evaluationLink,
        supports_url: supportsUrl,
      };

      const subject = processTemplate(subjectTemplate, variables, false);
      const contentText = processTemplate(contentTemplate, variables, false);
      const contentHtml = textToHtml(contentText);

      const htmlContent = `
        ${contentHtml}
        ${signature}
      `;

      console.log("Sending thank you email to:", participant.email);

      const result = await sendEmail({
        to: [participant.email],
        bcc: bccList,
        subject,
        html: htmlContent,
      });

      if (!result.success) {
        console.error("Resend error for", participant.email, ":", result.error);
        throw new Error(`Failed to send email to ${participant.email}: ${result.error}`);
      }

      results.push({ email: participant.email, success: true });

      // Wait 600ms between emails to respect Resend's rate limit (2/sec)
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log("Thank you emails sent successfully:", results.length);

    // Schedule follow-up emails for each participant
    console.log("Scheduling follow-up emails...");

    // Fetch email delay settings AND working days
    const { data: delaySettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "delay_google_review_days", "delay_video_testimonial_days",
        "delay_cold_evaluation_days", "delay_cold_evaluation_funder_days",
        "delay_evaluation_reminder_1_days", "delay_evaluation_reminder_2_days",
        "working_days"
      ]);

    let delayGoogleReview = 1;
    let delayVideoTestimonial = 3;
    let delayColdEvaluation = 10;
    let delayColdEvaluationFunder = 15;
    let delayEvaluationReminder1 = 2;
    let delayEvaluationReminder2 = 5;
    let workingDays = [false, true, true, true, true, true, false]; // Default: Mon-Fri

    delaySettings?.forEach((s: { setting_key: string; setting_value: string | null }) => {
      if (s.setting_key === "delay_google_review_days" && s.setting_value) {
        delayGoogleReview = parseInt(s.setting_value, 10) || 1;
      }
      if (s.setting_key === "delay_video_testimonial_days" && s.setting_value) {
        delayVideoTestimonial = parseInt(s.setting_value, 10) || 3;
      }
      if (s.setting_key === "delay_cold_evaluation_days" && s.setting_value) {
        delayColdEvaluation = parseInt(s.setting_value, 10) || 10;
      }
      if (s.setting_key === "delay_cold_evaluation_funder_days" && s.setting_value) {
        delayColdEvaluationFunder = parseInt(s.setting_value, 10) || 15;
      }
      if (s.setting_key === "delay_evaluation_reminder_1_days" && s.setting_value) {
        delayEvaluationReminder1 = parseInt(s.setting_value, 10) || 2;
      }
      if (s.setting_key === "delay_evaluation_reminder_2_days" && s.setting_value) {
        delayEvaluationReminder2 = parseInt(s.setting_value, 10) || 5;
      }
      if (s.setting_key === "working_days" && s.setting_value) {
        try {
          const parsed = JSON.parse(s.setting_value);
          if (Array.isArray(parsed) && parsed.length === 7) {
            workingDays = parsed;
          }
        } catch {
          // Keep default
        }
      }
    });

    // Reference date is NOW (when thank you email is sent), not training end date
    const referenceDate = new Date();

    // Schedule follow-up emails for each participant
    const emailsToSchedule: {
      training_id: string;
      participant_id: string | null;
      email_type: string;
      scheduled_for: string;
      status: string;
    }[] = [];

    for (const participant of participants) {
      // Check if emails are already scheduled for this participant
      const { data: existingEmails } = await supabase
        .from("scheduled_emails")
        .select("email_type")
        .eq("training_id", trainingId)
        .eq("participant_id", participant.id)
        .in("email_type", ["google_review", "video_testimonial", "evaluation_reminder_1", "evaluation_reminder_2"]);

      const existingTypes = new Set(existingEmails?.map(e => e.email_type) || []);

      // Schedule google_review (J+N working days)
      if (!existingTypes.has("google_review")) {
        const googleReviewDate = addWorkingDays(referenceDate, delayGoogleReview, workingDays);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "google_review",
          scheduled_for: googleReviewDate.toISOString(),
          status: "pending",
        });
      }

      // Schedule video_testimonial (J+N working days)
      if (!existingTypes.has("video_testimonial")) {
        const videoTestimonialDate = addWorkingDays(referenceDate, delayVideoTestimonial, workingDays);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "video_testimonial",
          scheduled_for: videoTestimonialDate.toISOString(),
          status: "pending",
        });
      }

      // Schedule evaluation_reminder_1 (J+N working days)
      if (!existingTypes.has("evaluation_reminder_1")) {
        const reminder1Date = addWorkingDays(referenceDate, delayEvaluationReminder1, workingDays);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "evaluation_reminder_1",
          scheduled_for: reminder1Date.toISOString(),
          status: "pending",
        });
      }

      // Schedule evaluation_reminder_2 (J+N working days)
      if (!existingTypes.has("evaluation_reminder_2")) {
        const reminder2Date = addWorkingDays(referenceDate, delayEvaluationReminder2, workingDays);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "evaluation_reminder_2",
          scheduled_for: reminder2Date.toISOString(),
          status: "pending",
        });
      }
    }

    // For inter-enterprise trainings, schedule cold_evaluation per participant with a sponsor
    // For intra-enterprise trainings, schedule cold_evaluation once for the training sponsor
    const isInterEntreprise = training.format_formation === "inter-entreprises" || training.format_formation === "e_learning";

    if (isInterEntreprise) {
      // Inter-enterprise: schedule per participant with sponsor_email
      for (const participant of participants) {
        if (participant.sponsor_email) {
          // Check if cold_evaluation already scheduled for this participant
          const { data: existingColdEval } = await supabase
            .from("scheduled_emails")
            .select("id")
            .eq("training_id", trainingId)
            .eq("participant_id", participant.id)
            .eq("email_type", "cold_evaluation")
            .single();

          if (!existingColdEval) {
            const coldEvaluationDate = addWorkingDays(referenceDate, delayColdEvaluation, workingDays);
            emailsToSchedule.push({
              training_id: trainingId,
              participant_id: participant.id,
              email_type: "cold_evaluation",
              scheduled_for: coldEvaluationDate.toISOString(),
              status: "pending",
            });
          }
        }
      }
    } else {
      // Intra-enterprise: schedule once for the training sponsor (commanditaire)
      const { data: existingColdEval } = await supabase
        .from("scheduled_emails")
        .select("id")
        .eq("training_id", trainingId)
        .eq("email_type", "cold_evaluation")
        .eq("participant_id", null)
        .single();

      if (!existingColdEval) {
        const coldEvaluationDate = addWorkingDays(referenceDate, delayColdEvaluation, workingDays);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: null, // For training-level sponsor
          email_type: "cold_evaluation",
          scheduled_for: coldEvaluationDate.toISOString(),
          status: "pending",
        });
      }
    }

    // Insert scheduled emails
    if (emailsToSchedule.length > 0) {
      const { error: scheduleError } = await supabase
        .from("scheduled_emails")
        .insert(emailsToSchedule);

      if (scheduleError) {
        console.error("Error scheduling follow-up emails:", scheduleError);
      } else {
        console.log(`Scheduled ${emailsToSchedule.length} follow-up emails`);
      }
    }

    // Schedule funder reminder emails
    const funderRemindersToSchedule: {
      training_id: string;
      participant_id: string | null;
      email_type: string;
      scheduled_for: string;
      status: string;
    }[] = [];

    if (isInterEntreprise) {
      // Inter-enterprise: schedule funder_reminder per participant where financeur_same_as_sponsor is false
      for (const participant of participants) {
        if (participant.financeur_same_as_sponsor === false && participant.financeur_name) {
          const { data: existingFunderReminder } = await supabase
            .from("scheduled_emails")
            .select("id")
            .eq("training_id", trainingId)
            .eq("participant_id", participant.id)
            .eq("email_type", "funder_reminder")
            .single();

          if (!existingFunderReminder) {
            const funderReminderDate = addWorkingDays(referenceDate, delayColdEvaluationFunder, workingDays);
            funderRemindersToSchedule.push({
              training_id: trainingId,
              participant_id: participant.id,
              email_type: "funder_reminder",
              scheduled_for: funderReminderDate.toISOString(),
              status: "pending",
            });
          }
        }
      }
    } else {
      // Intra-enterprise: schedule once at training level if funder is different from sponsor
      if (!training.financeur_same_as_sponsor && training.financeur_name) {
        const { data: existingFunderReminder } = await supabase
          .from("scheduled_emails")
          .select("id")
          .eq("training_id", trainingId)
          .eq("email_type", "funder_reminder")
          .eq("participant_id", null)
          .single();

        if (!existingFunderReminder) {
          const funderReminderDate = addWorkingDays(referenceDate, delayColdEvaluationFunder, workingDays);
          funderRemindersToSchedule.push({
            training_id: trainingId,
            participant_id: null,
            email_type: "funder_reminder",
            scheduled_for: funderReminderDate.toISOString(),
            status: "pending",
          });
        }
      }
    }

    // Insert funder reminder emails
    if (funderRemindersToSchedule.length > 0) {
      const { error: funderScheduleError } = await supabase
        .from("scheduled_emails")
        .insert(funderRemindersToSchedule);

      if (funderScheduleError) {
        console.error("Error scheduling funder reminder emails:", funderScheduleError);
      } else {
        console.log(`Scheduled ${funderRemindersToSchedule.length} funder reminder email(s)`);
      }
    }

    // Log activity for each recipient
    const emailSubject = processTemplate(subjectTemplate, { training_name: trainingName }, false);

    try {
      // deno-lint-ignore no-explicit-any
      const logInserts = participants.map((p: any) => ({
        action_type: "thank_you_email_sent",
        recipient_email: p.email,
        details: {
          training_id: trainingId,
          training_name: trainingName,
          participant_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
          email_subject: emailSubject,
          email_content: processTemplate(contentTemplate, {
            first_name: p.first_name,
            training_name: trainingName,
            evaluation_link: "[Lien d'évaluation personnalisé]",
            supports_url: supportsUrl,
          }, false),
        },
      }));
      await supabase.from("activity_logs").insert(logInserts);
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return createJsonResponse({
      success: true,
      recipientCount: participants.length
    });
  } catch (error: unknown) {
    console.error("Error sending thank you email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send thank you email";
    return createErrorResponse(errorMessage);
  }
});
