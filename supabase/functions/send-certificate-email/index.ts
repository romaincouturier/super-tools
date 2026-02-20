import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Get Signitic signature using shared module
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
const getSignature = getSigniticSignature;

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const evaluationId = String(body?.evaluationId ?? "").trim();
    const recipientEmail = String(body?.recipientEmail ?? "").trim();
    const recipientName = String(body?.recipientName ?? "").trim();

    if (!evaluationId) return createErrorResponse("evaluationId is required", 400);
    if (!recipientEmail) return createErrorResponse("recipientEmail is required", 400);

    const supabase = getSupabaseClient();

    // Fetch evaluation
    const { data: evaluation, error: evalError } = await supabase
      .from("training_evaluations")
      .select("*, training_id, certificate_url, first_name, last_name, email")
      .eq("id", evaluationId)
      .single();

    if (evalError || !evaluation) {
      return createErrorResponse("Evaluation not found", 404);
    }

    const certificateUrl = (evaluation as any).certificate_url as string | null;
    if (!certificateUrl) {
      return createErrorResponse("No certificate available for this evaluation", 400);
    }

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name")
      .eq("id", evaluation.training_id)
      .single();

    if (trainingError || !training) {
      return createErrorResponse("Training not found", 404);
    }

    // Download PDF from storage
    const pdfResponse = await fetch(certificateUrl);
    if (!pdfResponse.ok) {
      return createErrorResponse("Could not download certificate PDF", 500);
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const signatureHtml = await getSignature();

    const participantName = [evaluation.first_name, evaluation.last_name]
      .filter(Boolean)
      .join(" ") || "le participant";

    const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";

    const emailHtml = `
      <p>${greeting}</p>
      <p>Veuillez trouver en pièce jointe le certificat de réalisation de <strong>${participantName}</strong> pour la formation <strong>${training.training_name}</strong>.</p>
      <p>Bonne réception et à bientôt !</p>
      ${signatureHtml}
    `;

    const fileName = `Certificat_${training.training_name.replace(/[^a-zA-Z0-9]/g, "_")}_${participantName.replace(/\s+/g, "_")}.pdf`;

    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    await resend.emails.send({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject: `Certificat de réalisation - ${training.training_name} - ${participantName}`,
      html: emailHtml,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    });

    // Log activity
    await supabase.from("activity_logs").insert({
      action_type: "certificate_sent",
      recipient_email: recipientEmail,
      details: {
        evaluation_id: evaluationId,
        training_id: evaluation.training_id,
        training_name: training.training_name,
        participant_name: participantName,
        sent_to: recipientEmail,
      },
    });

    return createJsonResponse({ success: true });
  } catch (err) {
    console.error("[send-certificate-email] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
