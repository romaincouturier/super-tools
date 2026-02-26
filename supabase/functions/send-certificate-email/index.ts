import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { processTemplate, textToHtml } from "../_shared/templates.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Determine tu/vous - for manual send to sponsor, default to vous
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = `certificate_sponsor${templateTypeSuffix}`;

    // Fetch template, signature, sender, and BCC in parallel
    const [templateResult, signatureHtml, senderFrom, bccList] = await Promise.all([
      supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", templateType)
        .maybeSingle(),
      getSigniticSignature(),
      getSenderFrom(),
      getBccList(),
    ]);

    const customTemplate = templateResult.data;
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    const participantName = [evaluation.first_name, evaluation.last_name]
      .filter(Boolean)
      .join(" ") || "le participant";

    // Process template
    const variables = {
      first_name: recipientName || null,
      training_name: training.training_name,
      participant_name: participantName,
    };

    const subject = processTemplate(subjectTemplate, variables, false);
    const contentText = processTemplate(contentTemplate, variables, false);
    const contentHtml = textToHtml(contentText);
    const emailHtml = `${contentHtml}\n${signatureHtml}`;

    // Download PDF from storage
    const pdfResponse = await fetch(certificateUrl);
    if (!pdfResponse.ok) {
      return createErrorResponse("Could not download certificate PDF", 500);
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const fileName = `Certificat_${training.training_name.replace(/[^a-zA-Z0-9]/g, "_")}_${participantName.replace(/\s+/g, "_")}.pdf`;

    await resend.emails.send({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject,
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
        email_subject: subject,
      },
    });

    return createJsonResponse({ success: true });
  } catch (err) {
    console.error("[send-certificate-email] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
