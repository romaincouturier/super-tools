import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  getSigniticSignature,
  sendEmail,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { renderEditableEmail, ctaButton } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { learnerAccessLink } from "../_shared/learner-account.ts";

// Erratum: annule et remplace le lien erroné (panier WooCommerce) envoyé dans
// la relance `elearning_start_reminder`. Envoi unitaire par participant,
// avec possibilité d'un envoi de test (test_recipient).
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const { participant_id, participant_email, test_recipient } = body;
    if (!participant_id && !participant_email) {
      return createErrorResponse("participant_id ou participant_email requis", 400);
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from("training_participants")
      .select("id, first_name, last_name, email, training_id");
    query = participant_id
      ? query.eq("id", participant_id)
      : query.eq("email", participant_email);

    const { data: participant, error: pErr } = await query.limit(1).maybeSingle();
    if (pErr) return createErrorResponse(pErr.message, 500);
    if (!participant) return createErrorResponse("Participant introuvable", 404);

    const { data: training, error: tErr } = await supabase
      .from("trainings")
      .select("id, training_name")
      .eq("id", participant.training_id)
      .maybeSingle();
    if (tErr) return createErrorResponse(tErr.message, 500);
    if (!training) return createErrorResponse("Formation introuvable", 404);

    // Lien vers le portail apprenant SuperTools : jamais d'ouverture de
    // session automatique, même dans un erratum.
    const link = await learnerAccessLink(supabase, participant.email);
    if (!link) return createErrorResponse("Génération du lien d'accès impossible", 500);
    const accessLink = link.actionLink;

    const firstName = participant.first_name || "";
    const trainingName = training.training_name || "";
    const tpl = EDITABLE_EMAIL_DEFAULTS.elearning_erratum;
    const { subject, html: bodyHtml } = await renderEditableEmail(supabase, {
      type: "elearning_erratum",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: { first_name: firstName, training_name: trainingName },
      blocks: { access_button: ctaButton("Accéder à ma formation", accessLink) },
    });
    const html = `${bodyHtml}\n${await getSigniticSignature()}`;

    const to = test_recipient ? [test_recipient] : [participant.email];
    const bccList = test_recipient ? [] : await getBccList();

    const result = await sendEmail({
      to,
      bcc: bccList,
      subject: test_recipient ? `[TEST] ${subject}` : subject,
      html,
      _emailType: "elearning_start_reminder_erratum",
      _trainingId: training.id,
      _participantId: test_recipient ? undefined : participant.id,
    } as any);

    if (!result.success) return createErrorResponse(result.error || "Envoi échoué", 500);

    return createJsonResponse({
      success: true,
      to,
      subject,
      access_link: accessLink,
      participant: { id: participant.id, email: participant.email, first_name: firstName },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-elearning-erratum:", msg);
    return createErrorResponse(msg, 500);
  }
});
