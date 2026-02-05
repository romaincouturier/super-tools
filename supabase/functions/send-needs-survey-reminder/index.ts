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

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId } = await req.json();

    if (!participantId || !trainingId) {
      return createErrorResponse("participantId and trainingId are required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch BCC settings and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

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

    // Fetch training schedules for times
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Check if questionnaire exists and get token - PGRST116 means no rows
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
      // Create new questionnaire with token if doesn't exist
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
    const baseUrl = "https://super-tools.lovable.app";
    const questionnaireUrl = `${baseUrl}/questionnaire/${token}`;

    // Format training dates
    const formattedDate = formatDateWithDayFr(training.start_date);

    // Get schedule times
    let scheduleText = "";
    if (schedules && schedules.length > 0) {
      const firstSchedule = schedules[0];
      const startTime = firstSchedule.start_time.slice(0, 5);
      const endTime = firstSchedule.end_time.slice(0, 5);
      scheduleText = ` (${startTime} - ${endTime})`;
    }

    // Build friendly email
    const firstName = participant.first_name || "";
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    const htmlContent = `
      <p>${greeting}</p>
      <p>J'espère que tu vas bien ! 😊</p>
      <p>Je me permets de te relancer au sujet du <strong>questionnaire de recueil des besoins</strong> pour la formation <strong>"${training.training_name}"</strong>.</p>
      <p>Pour rappel, cette formation aura lieu <strong>le ${formattedDate}${scheduleText}</strong> à <strong>${training.location}</strong>.</p>
      <p>Ce questionnaire me permet de personnaliser le contenu de la formation en fonction de tes attentes et de ton contexte. Ça prend environ 5 minutes, promis ! 🙂</p>
      <p style="margin: 24px 0;">
        <a href="${questionnaireUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          ✏️ Remplir le questionnaire
        </a>
      </p>
      <p>Si tu as des questions ou si tu rencontres un souci technique, n'hésite surtout pas à me contacter !</p>
      <p>Merci d'avance et à très bientôt,</p>
      ${signature}
    `;

    // Send email
    const emailSubject = `Petit rappel : questionnaire pour la formation "${training.training_name}"`;
    const result = await sendEmail({
      to: [participant.email],
      bcc: bccList,
      subject: emailSubject,
      html: htmlContent,
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
