import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  emailButton,
  logEmailActivity,
} from "../_shared/mod.ts";
import { sendTemplatedEmail } from "../_shared/email-helpers.ts";
import { tuVousSuffix } from "../_shared/email-helpers.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { appendEmailParam, resolveSupportsUrlBase } from "../_shared/supports-url.ts";

/**
 * Informe les participants (et le formateur) qu'un contenu e-learning vient
 * d'être rattaché aux supports d'une formation.
 *
 * Déclenché automatiquement depuis la fiche formation lors du rattachement.
 * Idempotent : un même destinataire n'est prévenu qu'une fois par formation
 * et par support (clé de log = email:trainingId:supportKey).
 */

const ACTION_TYPE = "elearning_available_email_sent";

const DEFAULT_SUBJECT = "Un contenu en ligne est disponible pour {{training_name}}";
const DEFAULT_CONTENT = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle : un contenu en ligne vient d'être ajouté à la formation "{{training_name}}".

Vous pouvez le consulter dès maintenant, à votre rythme, avant, pendant et après la formation.

{{elearning_button}}

Ce lien est personnel : conservez-le, il reste valable pendant toute la durée de la formation.

Bonne exploration !`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const trainingId = typeof body.trainingId === "string" ? body.trainingId : null;
    if (!trainingId) return createErrorResponse("trainingId requis", 400);

    const supabase = getSupabaseClient();

    const { data: training, error: tErr } = await supabase
      .from("trainings")
      .select(
        "id, training_name, format_formation, supports_url, supports_lms_course_id, participants_formal_address, trainer_id",
      )
      .eq("id", trainingId)
      .maybeSingle();
    if (tErr) return createErrorResponse(tErr.message, 500);
    if (!training) return createErrorResponse("Formation introuvable", 404);

    const urls = await getAppUrls();
    // Lien e-learning explicite (envoi manuel/rattrapage) sinon résolution habituelle.
    const overrideUrl = typeof body.elearningUrl === "string" && /^https:\/\//.test(body.elearningUrl)
      ? body.elearningUrl
      : null;
    const supportsBase = overrideUrl ?? await resolveSupportsUrlBase(
      supabase,
      training,
      trainingId,
      urls.app_url,
    );
    if (!supportsBase) {
      return createJsonResponse({ success: true, skipped: "no_elearning_link", sent: 0 });
    }

    // Clé d'idempotence : change si le cours rattaché change.
    const supportKey = overrideUrl || training.supports_lms_course_id || supportsBase;


    const { data: participants, error: pErr } = await supabase
      .from("training_participants")
      .select("id, first_name, last_name, email")
      .eq("training_id", trainingId);
    if (pErr) return createErrorResponse(pErr.message, 500);

    const recipients: {
      email: string;
      first_name: string;
      participantId?: string;
      role: "participant" | "trainer";
    }[] = [];

    for (const p of participants || []) {
      if (!p.email) continue;
      recipients.push({
        email: p.email,
        first_name: p.first_name || "",
        participantId: p.id,
        role: "participant",
      });
    }

    if (training.trainer_id) {
      const { data: trainer } = await supabase
        .from("trainers")
        .select("first_name, email")
        .eq("id", training.trainer_id)
        .maybeSingle();
      if (trainer?.email && !recipients.some((r) => r.email === trainer.email)) {
        recipients.push({
          email: trainer.email,
          first_name: trainer.first_name || "",
          role: "trainer",
        });
      }
    }

    // Mail adressé aux participants et au formateur : le registre suit le réglage
    // participants, pas celui du commanditaire.
    const templateType = `elearning_available_${tuVousSuffix(training.participants_formal_address)}`;


    const results: { email: string; status: string; error?: string }[] = [];

    for (const recipient of recipients) {
      const logKey = `${recipient.email}:${trainingId}:${supportKey}`;
      const { data: existing } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("action_type", ACTION_TYPE)
        .eq("recipient_email", logKey)
        .limit(1);
      if (existing && existing.length > 0) {
        results.push({ email: recipient.email, status: "already_sent" });
        continue;
      }

      const personalLink = appendEmailParam(supportsBase, recipient.email);
      const result = await sendTemplatedEmail({
        supabase,
        to: recipient.email,
        templateType,
        defaultSubject: DEFAULT_SUBJECT,
        defaultContent: DEFAULT_CONTENT,
        variables: {
          first_name: recipient.first_name,
          training_name: training.training_name || "",
          elearning_url: personalLink,
          elearning_button: emailButton("Accéder au contenu en ligne", personalLink),
        },
        emailType: ACTION_TYPE,
        trainingId,
        participantId: recipient.participantId,
      });

      if (!result.success) {
        console.error(`send-elearning-available: échec ${recipient.email}: ${result.error}`);
        results.push({ email: recipient.email, status: "failed", error: result.error });
        continue;
      }

      await logEmailActivity(supabase, ACTION_TYPE, logKey, {
        training_id: trainingId,
        training_name: training.training_name,
        support_key: supportKey,
        role: recipient.role,
        participant_id: recipient.participantId || null,
        email: recipient.email,
      });
      results.push({ email: recipient.email, status: "sent" });

      // Espacement pour rester sous la limite de débit Resend.
      await new Promise((r) => setTimeout(r, 400));
    }

    return createJsonResponse({
      success: true,
      sent: results.filter((r) => r.status === "sent").length,
      already_sent: results.filter((r) => r.status === "already_sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-elearning-available:", msg);
    return createErrorResponse(msg, 500);
  }
});
