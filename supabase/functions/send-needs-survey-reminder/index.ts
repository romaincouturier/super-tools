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
import { resolveSessionDate } from "../_shared/training-date.ts";

// Default templates (fallback if no custom template in DB)
const DEFAULT_SUBJECT_TU = "Un petit rappel avant de démarrer ta formation";
const DEFAULT_SUBJECT_VOUS = "Un petit rappel avant de démarrer votre formation";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu as récemment rejoint la formation « {{training_name}} », et nous sommes ravis de t'accueillir !

Avant de te lancer, nous te proposons de répondre à quelques questions sur ton niveau, tes attentes et tes envies. Cela nous permet de comprendre ton point de départ et de mieux t'accompagner.

{{questionnaire_link}}

Cela ne te prendra que quelques minutes.

Merci pour ton retour, et bonne découverte de la formation !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous avez récemment rejoint la formation « {{training_name}} », et nous sommes ravis de vous accueillir !

Avant de vous lancer, nous vous proposons de répondre à quelques questions sur votre niveau, vos attentes et vos envies. Cela nous permet de comprendre votre point de départ et de mieux vous accompagner.

{{questionnaire_link}}

Cela ne vous prendra que quelques minutes.

Merci pour votre retour, et bonne découverte de la formation !`;

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
    const { data: existingRows, error: fetchError } = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("participant_id", participantId)
      .eq("training_id", trainingId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching questionnaire:", fetchError);
    }

    const existingQuestionnaire = existingRows && existingRows.length > 0 ? existingRows[0] : null;
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
        if ((insertError as any).code === "23505") {
          console.warn("Duplicate questionnaire detected, re-fetching existing row", { participantId, trainingId });
          const { data: duplicateRows, error: duplicateFetchError } = await supabase
            .from("questionnaire_besoins")
            .select("*")
            .eq("participant_id", participantId)
            .eq("training_id", trainingId)
            .order("created_at", { ascending: false })
            .limit(1);

          if (duplicateFetchError || !duplicateRows || duplicateRows.length === 0) {
            console.error("Error creating questionnaire (duplicate but not found):", insertError, duplicateFetchError, { participantId, trainingId });
            throw new Error(`Failed to create questionnaire: ${insertError.message} (code=${insertError.code})`);
          }

          token = duplicateRows[0].token;
        } else {
          console.error("Error creating questionnaire:", insertError, { participantId, trainingId });
          throw new Error(`Failed to create questionnaire: ${insertError.message} (code=${insertError.code})`);
        }
      } else if (!insertedData) {
        console.error("Questionnaire insert returned no data - possible RLS issue", { participantId, trainingId });
        throw new Error("Failed to create questionnaire - no data returned");
      } else {
        console.log("Successfully created questionnaire:", insertedData.id);
      }
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
    const { sessionStart } = resolveSessionDate(schedules, training.start_date, training.end_date);
    const formattedDate = sessionStart ? formatDateWithDayFr(sessionStart) : "";

    // Process template
    const variables = {
      first_name: participant.first_name || null,
      training_name: training.training_name,
      training_date: formattedDate || null,
      training_location: training.location || "",
      questionnaire_link: questionnaireUrl,
    };

    const ctaMarker = "NEEDS_SURVEY_QUESTIONNAIRE_CTA";
    const safeContentTemplate = contentTemplate.replaceAll("{{questionnaire_link}}", ctaMarker);
    const emailSubject = processTemplate(subjectTemplate, variables, false);
    const contentText = processTemplate(safeContentTemplate, variables, false);
    const questionnaireButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;"><tr><td align="center" bgcolor="#e6bc00" style="border-radius: 6px;"><a href="${questionnaireUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #1a1a1a; text-decoration: none; border-radius: 6px; font-weight: bold;">Répondre au questionnaire de préparation</a></td></tr></table>`;
    const questionnaireCta = `${questionnaireButton}
<p style="margin: 8px 0 20px; font-size: 12px; color: #555555;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${questionnaireUrl}" style="color: #555555; text-decoration: underline; word-break: break-all;">${questionnaireUrl}</a></p>`;
    const contentHtml = textToHtml(contentText).replace(`<p>${ctaMarker}</p>`, questionnaireCta);
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
    return createErrorResponse(errorMessage, 500, { cause: error, fn: "send-needs-survey-reminder" });
  }
});
