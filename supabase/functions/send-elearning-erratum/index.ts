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
      .select("id, training_name, supertilt_link")
      .eq("id", participant.training_id)
      .maybeSingle();
    if (tErr) return createErrorResponse(tErr.message, 500);
    if (!training) return createErrorResponse("Formation introuvable", 404);

    const isHttpUrl = (v: unknown): v is string =>
      typeof v === "string" && /^https?:\/\//i.test(v.trim());
    const accessLink = isHttpUrl(training.supertilt_link)
      ? training.supertilt_link.trim()
      : "https://www.supertilt.fr";

    const firstName = participant.first_name || "";
    const trainingName = training.training_name || "";
    const subject = `Erratum : le bon lien pour reprendre ${trainingName}`;

    const paragraphs = [
      `Bonjour ${firstName},`,
      `Je reviens vers vous suite au message que je vous ai adressé ce matin au sujet de la formation « ${trainingName} ».`,
      `Le lien qu'il contenait était erroné : il renvoyait vers une page de commande, alors que votre inscription est bien enregistrée et réglée. Toutes mes excuses pour la confusion.`,
      `Ce message annule et remplace le précédent. Voici le bon lien pour accéder à votre formation :`,
      `<a href="${accessLink}">${accessLink}</a>`,
      `Le rythme reste totalement libre, vous avancez à votre convenance. Si le moindre point vous freine, répondez simplement à ce mail.`,
      `À très vite,`,
    ];

    const html = `${paragraphs.map((p) => `<p>${p}</p>`).join("\n")}\n${await getSigniticSignature()}`;

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
