import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import {
  tuVousSuffix,
  prepareTemplatedEmail,
  logEmailActivity,
} from "../_shared/email-helpers.ts";
import { sendEmail } from "../_shared/resend.ts";

// Default templates
const DEFAULT_SUBJECT_TU = "Certificat de réalisation - {{training_name}} - {{participant_name}}";
const DEFAULT_SUBJECT_VOUS = "Certificat de réalisation - {{training_name}} - {{participant_name}}";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu trouveras en pièce jointe le certificat de réalisation de {{participant_name}} pour la formation "{{training_name}}".

Bonne réception et à bientôt !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Veuillez trouver en pièce jointe le certificat de réalisation de {{participant_name}} pour la formation "{{training_name}}".

Bonne réception et à bientôt !`;

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
      .select("training_name, participants_formal_address")
      .eq("id", evaluation.training_id)
      .single();

    if (trainingError || !training) {
      return createErrorResponse("Training not found", 404);
    }

    // Determine tu/vous
    const suffix = tuVousSuffix(training.participants_formal_address);
    const templateType = `certificate_sponsor_${suffix}`;
    const defaultSubject = suffix === "tu" ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = suffix === "tu" ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;

    const participantName = [evaluation.first_name, evaluation.last_name]
      .filter(Boolean)
      .join(" ") || "le participant";

    // Download PDF from storage
    const pdfResponse = await fetch(certificateUrl);
    if (!pdfResponse.ok) {
      return createErrorResponse("Could not download certificate PDF", 500);
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const fileName = `Certificat_${training.training_name.replace(/[^a-zA-Z0-9]/g, "_")}_${participantName.replace(/\s+/g, "_")}.pdf`;

    // Prepare and send email using shared helpers
    const variables = {
      first_name: recipientName || null,
      training_name: training.training_name,
      participant_name: participantName,
    };

    const prepared = await prepareTemplatedEmail({
      supabase,
      to: recipientEmail,
      templateType,
      defaultSubject,
      defaultContent,
      variables,
      emailType: "certificate_sponsor",
      trainingId: evaluation.training_id,
      participantId: (evaluation as any).participant_id || undefined,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    });

    await sendEmail(prepared);

    // Log activity
    await logEmailActivity(supabase, "certificate_sent", recipientEmail, {
      evaluation_id: evaluationId,
      training_id: evaluation.training_id,
      training_name: training.training_name,
      participant_name: participantName,
      sent_to: recipientEmail,
      email_subject: prepared.subject,
    });

    return createJsonResponse({ success: true });
  } catch (err) {
    console.error("[send-certificate-email] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
