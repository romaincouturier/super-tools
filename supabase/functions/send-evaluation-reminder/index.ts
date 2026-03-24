import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";
import {
  tuVousSuffix,
  sendTemplatedEmail,
  logEmailActivity,
} from "../_shared/email-helpers.ts";

// Default templates - Reminder 1
const DEFAULT_SUBJECTS_REMINDER_1: Record<string, string> = {
  tu: '📝 Petit rappel : ton avis compte pour "{{training_name}}"',
  vous: '📝 Petit rappel : votre avis compte pour "{{training_name}}"',
};

const DEFAULT_CONTENTS_REMINDER_1: Record<string, string> = {
  tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour ta contribution !

Belle journée à toi`,
  vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour votre contribution !

Belle journée à vous`,
};

// Default templates - Reminder 2
const DEFAULT_SUBJECTS_REMINDER_2: Record<string, string> = {
  tu: '🙏 Dernière relance : ta contribution pour "{{training_name}}"',
  vous: '🙏 Dernière relance : votre contribution pour "{{training_name}}"',
};

const DEFAULT_CONTENTS_REMINDER_2: Record<string, string> = {
  tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers toi une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !

Si tu as 2 minutes, voici le lien :
{{evaluation_link}}

Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !

À bientôt`,
  vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers vous une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !

Si vous avez 2 minutes, voici le lien :
{{evaluation_link}}

Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !

À bientôt`,
};

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { scheduledEmailId } = await req.json();

    if (!scheduledEmailId) {
      return createErrorResponse("scheduledEmailId is required", 400);
    }

    const supabase = getSupabaseClient();
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;

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

    // Determine tu/vous suffix and template type
    const suffix = tuVousSuffix(training.participants_formal_address);
    const templateType = isReminder1 ? "evaluation_reminder_1" : "evaluation_reminder_2";

    // Select defaults based on reminder type and formality
    const defaultSubject = isReminder1
      ? DEFAULT_SUBJECTS_REMINDER_1[suffix]
      : DEFAULT_SUBJECTS_REMINDER_2[suffix];
    const defaultContent = isReminder1
      ? DEFAULT_CONTENTS_REMINDER_1[suffix]
      : DEFAULT_CONTENTS_REMINDER_2[suffix];

    console.log("Using template type:", `${templateType}_${suffix}`);

    // Build evaluation link
    const evaluationLink = `${appUrl}/evaluation/${evaluation.token}`;

    const variables = {
      first_name: participant.first_name,
      training_name: training.training_name,
      evaluation_link: evaluationLink,
    };

    console.log(`Sending ${templateType} to:`, participant.email);

    const result = await sendTemplatedEmail({
      supabase,
      to: participant.email,
      templateType: `${templateType}_${suffix}`,
      defaultSubject,
      defaultContent,
      variables,
      emailType: "evaluation_reminder",
      trainingId,
      participantId,
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
    await logEmailActivity(supabase, `${templateType}_sent`, participant.email, {
      training_id: trainingId,
      training_name: training.training_name,
      participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
      email_subject: defaultSubject,
    });

    console.log(`${templateType} sent successfully to ${participant.email}`);

    return createJsonResponse({ success: true, email: participant.email });
  } catch (error: unknown) {
    console.error("Error sending evaluation reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send evaluation reminder";
    return createErrorResponse(errorMessage);
  }
});
