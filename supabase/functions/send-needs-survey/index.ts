import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  escapeHtml,
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

    // Check if questionnaire already exists
    let questionnaire = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("participant_id", participantId)
      .eq("training_id", trainingId)
      .single();

    let token: string;

    if (questionnaire.data) {
      // Use existing token
      token = questionnaire.data.token;
    } else {
      // Create new questionnaire with token
      token = crypto.randomUUID();

      const { error: insertError } = await supabase
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
        });

      if (insertError) {
        console.error("Error creating questionnaire:", insertError);
        throw new Error("Failed to create questionnaire");
      }
    }

    // Update participant status
    await supabase
      .from("training_participants")
      .update({
        needs_survey_status: "envoye",
        needs_survey_sent_at: new Date().toISOString(),
        needs_survey_token: token,
      })
      .eq("id", participantId);

    // Update questionnaire status if it already existed
    if (questionnaire.data) {
      await supabase
        .from("questionnaire_besoins")
        .update({
          etat: "envoye",
          date_envoi: new Date().toISOString(),
        })
        .eq("id", questionnaire.data.id);
    }

    // Build questionnaire URL - use published domain
    const baseUrl = "https://super-tools.lovable.app";
    const questionnaireUrl = `${baseUrl}/questionnaire/${token}`;

    // Format training date
    const formattedDate = formatDateWithDayFr(training.start_date);

    // Build email
    const firstName = participant.first_name || "";
    const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
    const safeTrainingName = escapeHtml(training.training_name);

    const htmlContent = `
      <p>${greeting}</p>
      <p>Vous êtes inscrit(e) à la formation <strong>"${safeTrainingName}"</strong> qui aura lieu le <strong>${formattedDate}</strong>.</p>
      <p>Afin de personnaliser cette formation à vos attentes, je vous invite à remplir un court questionnaire de recueil des besoins :</p>
      <p style="margin: 20px 0;">
        <a href="${questionnaireUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Accéder au questionnaire
        </a>
      </p>
      <p>Ce questionnaire vous prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à vos besoins spécifiques.</p>
      <p>Merci de le compléter <strong>au moins 2 jours avant la formation</strong>.</p>
      ${signature}
    `;

    // Send email
    const emailSubject = `Questionnaire de recueil des besoins - ${training.training_name}`;
    const result = await sendEmail({
      to: [participant.email],
      bcc: bccList,
      subject: emailSubject,
      html: htmlContent,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log("Needs survey email sent to:", participant.email, result.id);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "needs_survey_sent",
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
          email_subject: emailSubject,
          email_content: `${firstName ? `Bonjour ${firstName},` : "Bonjour,"}\n\nVous êtes inscrit(e) à la formation "${training.training_name}" qui aura lieu le ${formattedDate}.\n\nAfin de personnaliser cette formation à vos attentes, je vous invite à remplir un court questionnaire de recueil des besoins.\n\nCe questionnaire vous prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à vos besoins spécifiques.\n\nMerci de le compléter au moins 2 jours avant la formation.`,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error sending needs survey:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send needs survey";
    return createErrorResponse(errorMessage);
  }
});
