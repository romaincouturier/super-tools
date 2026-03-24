import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  formatDateWithDayFr,
  emailButton,
} from "../_shared/mod.ts";
import {
  tuVousSuffix,
  sendTemplatedEmail,
  logEmailActivity,
} from "../_shared/email-helpers.ts";

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
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;

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

    // Determine tu/vous
    const useFormal = isIntra ? training.sponsor_formal_address : true;
    const suffix = tuVousSuffix(useFormal);
    const templateType = `convention_reminder_${suffix}`;

    // Build greeting
    const greeting = recipientFirstName
      ? `Bonjour ${recipientFirstName},`
      : "Bonjour,";

    // Build default content based on tu/vous
    const signatureBlock = signatureUrl
      ? emailButton("✍️ Signer la convention en ligne", signatureUrl)
      : "";

    const defaultSubject = `Rappel : convention de formation "${training.training_name}"`;

    const defaultContent = useFormal
      ? `
<p>${greeting}</p>
<p>Je me permets de vous relancer au sujet de la <strong>convention de formation</strong> pour la formation <strong>"${training.training_name}"</strong> prévue le <strong>${formattedDate}</strong>.</p>
<p>Pourriez-vous nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?</p>
${signatureBlock}
<p>Je reste à votre disposition pour toute question.</p>
<p>Bien cordialement,</p>`
      : `
<p>${greeting}</p>
<p>Je me permets de te relancer au sujet de la <strong>convention de formation</strong> pour la formation <strong>"${training.training_name}"</strong> prévue le <strong>${formattedDate}</strong>.</p>
<p>Peux-tu nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?</p>
${signatureBlock}
<p>N'hésite pas si tu as des questions !</p>
<p>À bientôt,</p>`;

    // Send email using shared helper
    const result = await sendTemplatedEmail({
      supabase,
      to: recipientEmail,
      templateType,
      defaultSubject,
      defaultContent,
      variables: {
        first_name: recipientFirstName,
        training_name: training.training_name,
        training_date: formattedDate,
        signature_link: signatureUrl,
      },
      emailType: "convention_reminder",
      trainingId,
      participantId: participantId || undefined,
      convertToHtml: false,
    });

    if (!result.success) {
      throw new Error(`Échec de l'envoi de l'email: ${result.error}`);
    }

    console.log("Convention reminder sent to:", recipientEmail, result);

    // Log activity using shared helper
    await logEmailActivity(supabase, "convention_reminder_sent", recipientEmail, {
      training_id: trainingId,
      training_name: training.training_name,
      participant_id: participantId || null,
      format_formation: training.format_formation,
    });

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error sending convention reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send convention reminder";
    return createErrorResponse(errorMessage);
  }
});
