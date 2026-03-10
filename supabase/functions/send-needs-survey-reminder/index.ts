import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
import { processTemplate, textToHtml } from "../_shared/templates.ts";

// Default templates (fallback if no custom template in DB)
const DEFAULT_SUBJECT_TU = "Rappel : Prépare ta formation \"{{training_name}}\"";
const DEFAULT_SUBJECT_VOUS = "Rappel : Préparez votre formation \"{{training_name}}\"";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de te relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Ton retour m'est précieux pour adapter au mieux le contenu à tes besoins.

{{questionnaire_link}}

Merci d'avance pour ta participation !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Votre retour m'est précieux pour adapter au mieux le contenu à vos besoins.

{{questionnaire_link}}

Merci d'avance pour votre participation !`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId } = await req.json();

    if (!participantId || !trainingId) {
      return createErrorResponse("participantId and trainingId are required", 400);
    }

    const supabase = getSupabaseClient();
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;

    // Fetch participant and training info
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Determine tu/vous
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = `needs_survey_reminder${templateTypeSuffix}`;

    // Fetch template, BCC, signature, and schedules in parallel
    const [templateResult, bccList, signature, schedulesResult] = await Promise.all([
      supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", templateType)
        .maybeSingle(),
      getBccSettings(supabase),
      getSigniticSignature(),
      supabase
        .from("training_schedules")
        .select("*")
        .eq("training_id", trainingId)
        .order("day_date", { ascending: true }),
    ]);

    const customTemplate = templateResult.data;
    const schedules = schedulesResult.data;
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Check if questionnaire exists and get token
    const { data: existingQuestionnaire, error: fetchError } = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("participant_id", participantId)
      .eq("training_id", trainingId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching questionnaire:", fetchError);
    }

    let token: string;

    if (existingQuestionnaire) {
      token = existingQuestionnaire.token;
      console.log("Using existing questionnaire with token:", token);
    } else {
      token = crypto.randomUUID();
      console.log("Creating new questionnaire with token:", token);

      const { data: insertedData, error: insertError } = await supabase
        .from("questionnaire_besoins")
        .insert({
          participant_id: participantId,
          training_id: trainingId,
          token,
          etat: "envoye",
          email: participant.email,
          prenom: participant.first_name,
          nom: participant.last_name,
          societe: participant.company,
          date_envoi: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating questionnaire:", insertError);
        throw new Error("Failed to create questionnaire");
      }

      if (!insertedData) {
        console.error("Questionnaire insert returned no data - possible RLS issue");
        throw new Error("Failed to create questionnaire - no data returned");
      }

      console.log("Successfully created questionnaire:", insertedData.id);
    }

    // Update participant status
    const { error: participantUpdateError } = await supabase
      .from("training_participants")
      .update({
        needs_survey_status: "envoye",
        needs_survey_sent_at: new Date().toISOString(),
        needs_survey_token: token,
      })
      .eq("id", participantId);

    if (participantUpdateError) {
      console.error("Error updating participant:", participantUpdateError);
    }

    // Build questionnaire URL
    const questionnaireUrl = `${appUrl}/questionnaire/${token}`;
    const formattedDate = formatDateWithDayFr(training.start_date);

    // Process template
    const variables = {
      first_name: participant.first_name || null,
      training_name: training.training_name,
      training_date: formattedDate,
      training_location: training.location || "",
      questionnaire_link: questionnaireUrl,
    };

    const emailSubject = processTemplate(subjectTemplate, variables, false);
    const contentText = processTemplate(contentTemplate, variables, false);
    const contentHtml = textToHtml(contentText);
    const htmlContent = `${contentHtml}\n${signature}`;

    // Send email
    const result = await sendEmail({
      to: [participant.email],
      bcc: bccList,
      subject: emailSubject,
      html: htmlContent,
      _emailType: "needs_survey_reminder",
      _trainingId: trainingId,
      _participantId: participantId,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log("Needs survey reminder sent to:", participant.email, result);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "needs_survey_reminder_sent",
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
          email_subject: emailSubject,
          email_content: contentText,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error sending needs survey reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send reminder";
    return createErrorResponse(errorMessage);
  }
});
