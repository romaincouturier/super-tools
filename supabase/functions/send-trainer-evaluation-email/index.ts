import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getSupabaseClient,
  sendEmail,
} from "../_shared/mod.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainerEmail, trainerName, trainingName, evaluationLink, evaluationId } = await req.json();

    if (!trainerEmail || !evaluationLink) {
      return createErrorResponse("trainerEmail and evaluationLink are required", 400);
    }

    const signature = await getSigniticSignature();

    const html = `
      <p>Bonjour ${trainerName || ""},</p>
      <p>La formation « <strong>${trainingName}</strong> » est maintenant terminée.</p>
      <p>Merci de prendre quelques minutes pour donner votre retour sur cette session en cliquant sur le lien ci-dessous :</p>
      <p><a href="${evaluationLink}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Donner mon retour</a></p>
      <p>Ce formulaire prend environ 2 minutes.</p>
      <p>Merci,<br/>L'équipe SuperTilt</p>
      ${signature}
    `;

    const result = await sendEmail({
      to: [trainerEmail],
      subject: `Votre retour sur la formation « ${trainingName} »`,
      html,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    // Log activity
    const supabase = getSupabaseClient();
    await supabase.from("activity_logs").insert({
      action_type: "trainer_evaluation_sent",
      recipient_email: trainerEmail,
      details: {
        training_name: trainingName,
        trainer_name: trainerName,
        evaluation_id: evaluationId,
      },
    });

    return createJsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("Error sending trainer evaluation email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    return createErrorResponse(errorMessage);
  }
});
