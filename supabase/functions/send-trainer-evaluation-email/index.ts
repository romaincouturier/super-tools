import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getSupabaseClient,
  sendEmail,
  emailButton,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const {
      trainerEmail,
      trainerName,
      trainingName,
      evaluationLink,
      evaluationId,
      clientName,
      startDate,
      endDate,
    } = await req.json();

    if (!trainerEmail || !evaluationLink) {
      return createErrorResponse("trainerEmail and evaluationLink are required", 400);
    }

    const [signature, bccList] = await Promise.all([getSigniticSignature(), getBccList()]);

    const formatDate = (date: string | null | undefined) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    const startDateFormatted = formatDate(startDate);
    const endDateFormatted = formatDate(endDate);
    const dateLine = endDateFormatted
      ? `du ${startDateFormatted} au ${endDateFormatted}`
      : startDateFormatted
        ? `le ${startDateFormatted}`
        : "";

    const html = `
      <p>Bonjour ${trainerName || ""},</p>
      <p>
        La formation « <strong>${trainingName}</strong> »
        ${clientName ? `pour <strong>${clientName}</strong>` : ""}
        ${dateLine ? `(${dateLine})` : ""}
        est maintenant terminée.
      </p>
      <p>Merci de prendre quelques minutes pour donner votre retour sur cette session en cliquant sur le lien ci-dessous :</p>
      ${emailButton("Donner mon retour", evaluationLink)}
      <p>Ce formulaire prend environ 2 minutes.</p>
      <p>Merci,<br/>L'équipe SuperTilt</p>
      ${signature}
    `;

    const result = await sendEmail({
      to: [trainerEmail],
      bcc: bccList,
      subject: `Votre retour – ${trainingName}${clientName ? ` (${clientName})` : ""}${dateLine ? ` – ${dateLine}` : ""}`,
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
        client_name: clientName,
        start_date: startDate,
        end_date: endDate,
      },
    });

    return createJsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("Error sending trainer evaluation email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    return createErrorResponse(errorMessage);
  }
});
