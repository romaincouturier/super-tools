import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  sendEmail,
  textToHtml,
  getAppUrls,
} from "../_shared/mod.ts";

import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { surveyId, isReminder, includeTrainer } = await req.json();
    if (!surveyId) return createErrorResponse("surveyId requis", 400);

    const supabase = getSupabaseClient();

    const { data: survey, error: sErr } = await (supabase as any)
      .from("training_surveys")
      .select("id, training_id, title, intro_message, email_subject, email_body, closes_at")
      .eq("id", surveyId)
      .maybeSingle();
    if (sErr || !survey) return createErrorResponse("Sondage introuvable", 404);

    const { data: training } = await supabase
      .from("trainings")
      .select("training_name, trainer_id, trainer_name")
      .eq("id", survey.training_id)
      .maybeSingle();

    // Sync recipients with current participants
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, email, first_name, last_name")
      .eq("training_id", survey.training_id);

    const recipientsList: { id?: string; participant_id: string | null; email: string; first_name: string | null; last_name: string | null }[] = [];

    if (participants) {
      for (const p of participants as any[]) {
        recipientsList.push({ participant_id: p.id, email: p.email, first_name: p.first_name, last_name: p.last_name });
      }
    }

    // Optionally include trainer as a virtual recipient (participant_id NULL)
    if (includeTrainer && (training as any)?.trainer_id) {
      const { data: trainer } = await (supabase as any)
        .from("trainers")
        .select("email, first_name, last_name")
        .eq("id", (training as any).trainer_id)
        .maybeSingle();
      if (trainer?.email) {
        recipientsList.push({ participant_id: null, email: trainer.email, first_name: trainer.first_name ?? (training as any).trainer_name ?? null, last_name: trainer.last_name ?? null });
      }
    }

    if (recipientsList.length === 0) {
      return createErrorResponse("Aucun destinataire", 400);
    }

    const { data: existingRecipients } = await (supabase as any)
      .from("training_survey_recipients")
      .select("id, participant_id, email, token, sent_at")
      .eq("survey_id", surveyId);

    const recByPid = new Map<string, any>(
      (existingRecipients ?? []).filter((r: any) => r.participant_id).map((r: any) => [r.participant_id, r]),
    );
    const recByEmail = new Map<string, any>(
      (existingRecipients ?? []).filter((r: any) => !r.participant_id && r.email).map((r: any) => [String(r.email).toLowerCase(), r]),
    );

    const toCreate = recipientsList.filter((p) => {
      if (p.participant_id) return !recByPid.has(p.participant_id);
      return !recByEmail.has(p.email.toLowerCase());
    });
    if (toCreate.length > 0) {
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("training_survey_recipients")
        .insert(
          toCreate.map((p) => ({
            survey_id: surveyId,
            participant_id: p.participant_id,
            email: p.email,
            first_name: p.first_name,
            last_name: p.last_name,
          })),
        )
        .select("id, participant_id, email, token, sent_at");
      if (insErr) return createErrorResponse(`Erreur recipients: ${insErr.message}`, 500);
      for (const r of inserted ?? []) {
        if (r.participant_id) recByPid.set(r.participant_id, r);
        else if (r.email) recByEmail.set(String(r.email).toLowerCase(), r);
      }
    }


    const [senderFrom, bccList, signatureHtml, urls] = await Promise.all([
      getSenderFrom(),
      getBccList(),
      getSigniticSignature(),
      getAppUrls(),
    ]);

    const baseUrl = urls.app_url || "https://super-tools.lovable.app";
    const subject =
      survey.email_subject?.trim() ||
      `Sondage : ${survey.title || training?.training_name || "votre formation"}`;
    const introBody = (survey.email_body || survey.intro_message || "").trim();

    let sent = 0;
    let failed = 0;

    for (const p of participants as any[]) {
      const rec = recByPid.get(p.id);
      if (!rec) continue;

      // Skip already-sent if not a reminder
      if (!isReminder && rec.sent_at) continue;

      const firstName = p.first_name || "";
      const link = `${baseUrl}/sondage-formation/${rec.token}`;

      const personalized = (introBody || `Bonjour {{first_name}},\n\nMerci de prendre quelques minutes pour répondre à ce sondage.`)
        .replace(/\{\{first_name\}\}/g, firstName);

      const bodyHtml = textToHtml(personalized);

      const button = `
        <div style="margin: 24px 0;">
          <a href="${link}" style="background-color:#2563eb;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Répondre au sondage</a>
        </div>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">Ou copiez ce lien : <a href="${link}">${link}</a></p>
      `;

      const closesNote = survey.closes_at
        ? `<p style="font-size:13px;color:#374151;">Merci de répondre avant le <strong>${new Date(survey.closes_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" })}</strong>.</p>`
        : "";

      const html = `${bodyHtml}\n${button}\n${closesNote}\n${signatureHtml}`;

      const finalSubject = isReminder ? `Rappel : ${subject}` : subject;

      const result = await sendEmail({
        to: [p.email],
        from: senderFrom,
        bcc: bccList,
        subject: finalSubject,
        html,
        _emailType: isReminder ? "training_survey_reminder" : "training_survey",
        _trainingId: survey.training_id,
        _participantId: p.id,
      });

      if (result.success) {
        sent++;
        const patch: any = isReminder ? { last_reminded_at: new Date().toISOString() } : { sent_at: new Date().toISOString() };
        await (supabase as any).from("training_survey_recipients").update(patch).eq("id", rec.id);
      } else {
        failed++;
        console.error("Failed survey email", p.email, result.error);
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    if (!isReminder) {
      await (supabase as any)
        .from("training_surveys")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", surveyId);
    }

    return createJsonResponse({ success: true, sent, failed });
  } catch (error) {
    console.error("send-training-survey error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Internal error", 500);
  }
});
