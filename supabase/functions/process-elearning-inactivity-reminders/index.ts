import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getSupabaseClient,
  sendEmail,
  todayAsISO,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { isInternalCall } from "../_shared/cron-auth.ts";
import { renderCatalogEmail, ctaButton } from "../_shared/editable-email.ts";
import { learnerAccessLink } from "../_shared/learner-account.ts";
import { normalizeLearnerEmail } from "../_shared/learner-email.ts";

// Relance les apprenants e-learning sans activité depuis 6 mois : non démarrés
// (comptés depuis l'inscription) ou en cours (comptés depuis la dernière leçon
// ouverte). Une seule relance par période d'inactivité : un envoi postérieur à
// la dernière activité bloque le suivant jusqu'à une reprise.
// Les participants sans inscription LMS (anciens inscrits LearnDash) sont ignorés.
// Corps optionnel : { "dry_run": true } liste les relances sans rien envoyer.

const EMAIL_TYPE = "elearning_inactivity_reminder";
const INACTIVITY_MONTHS = 6;

interface ElearningTraining {
  id: string;
  training_name: string | null;
  start_date: string | null;
  supports_lms_course_id: string;
  sponsor_formal_address: boolean | null;
  is_cancelled: boolean | null;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Cron (x-cron-secret) ou appel interne (service_role) uniquement.
    if (!isInternalCall(req, "ELEARNING_CRON_SECRET")) {
      return createErrorResponse("Non autorisé", 401);
    }

    let dryRun = false;
    try {
      const raw = await req.text();
      dryRun = raw ? JSON.parse(raw)?.dry_run === true : false;
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const supabase = getSupabaseClient();

    const todayIso = todayAsISO();
    const { data: allTrainings, error: tErr } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, supports_lms_course_id, sponsor_formal_address, is_cancelled")
      .eq("format_formation", "e_learning")
      .not("supports_lms_course_id", "is", null);
    if (tErr) return createErrorResponse(tErr.message, 500);

    const trainings = ((allTrainings || []) as ElearningTraining[]).filter(
      (t) => !t.is_cancelled && (!t.start_date || t.start_date <= todayIso),
    );
    if (trainings.length === 0) {
      return createJsonResponse({ success: true, processed: 0, sent: 0, dry_run: dryRun });
    }
    const trainingsById = new Map(trainings.map((t) => [t.id, t]));

    const { data: participants, error: pErr } = await supabase
      .from("training_participants")
      .select("id, training_id, first_name, email, repositioned_to_training_id")
      .in("training_id", trainings.map((t) => t.id))
      .is("repositioned_to_training_id", null);
    if (pErr) return createErrorResponse(pErr.message, 500);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);
    const cutoffMs = cutoff.getTime();

    const bccList = dryRun ? [] : await getBccList();
    const signature = dryRun ? "" : await getSigniticSignature();

    let processed = 0;
    let sent = 0;
    const due: Array<Record<string, unknown>> = [];

    for (const p of participants || []) {
      processed++;
      const training = trainingsById.get(p.training_id);
      const email = normalizeLearnerEmail(p.email);
      if (!training || !email) continue;
      const courseId = training.supports_lms_course_id;

      const { data: enrollment } = await supabase
        .from("lms_enrollments")
        .select("enrolled_at, completion_percentage, status")
        .eq("course_id", courseId)
        .eq("learner_email", email)
        .maybeSingle();
      if (!enrollment) continue;
      const progression = Math.round(Number(enrollment.completion_percentage || 0));
      if (enrollment.status === "completed" || progression >= 100) continue;

      const { data: lastProgress } = await supabase
        .from("lms_progress")
        .select("updated_at")
        .eq("course_id", courseId)
        .eq("learner_email", email)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastActivity = lastProgress?.updated_at ?? enrollment.enrolled_at;
      if (new Date(lastActivity).getTime() > cutoffMs) continue;

      const { count: alreadySent } = await supabase
        .from("sent_emails_log")
        .select("id", { count: "exact", head: true })
        .eq("email_type", EMAIL_TYPE)
        .eq("participant_id", p.id)
        .gt("sent_at", lastActivity);
      if ((alreadySent || 0) > 0) continue;

      const started = !!lastProgress || progression > 0;
      due.push({
        participant_id: p.id,
        email,
        training: training.training_name,
        progression,
        last_activity: lastActivity,
      });
      if (dryRun) continue;

      const link = await learnerAccessLink(supabase, email);
      if (!link) {
        console.error(`${EMAIL_TYPE}: access link generation failed for participant ${p.id}`);
        continue;
      }

      const { subject, html: bodyHtml } = await renderCatalogEmail(supabase, EMAIL_TYPE, {
        formal: !!training.sponsor_formal_address,
        vars: {
          first_name: p.first_name || "",
          training_name: training.training_name || "",
          progression: String(progression),
          non_demarre: started ? "" : "1",
          en_cours: started ? "1" : "",
        },
        blocks: { access_button: ctaButton("Reprendre ma formation", link.actionLink) },
      });

      const result = await sendEmail({
        to: [email],
        bcc: bccList,
        subject,
        html: `${bodyHtml}\n${signature}`,
        _emailType: EMAIL_TYPE,
        _trainingId: training.id,
        _participantId: p.id,
      });

      if (result.success) sent++;
      else console.error(`${EMAIL_TYPE} failed for participant ${p.id}:`, result.error);

      await new Promise((r) => setTimeout(r, 400));
    }

    return createJsonResponse({ success: true, dry_run: dryRun, processed, due: due.length, sent, ...(dryRun ? { list: due } : {}) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-elearning-inactivity-reminders:", msg);
    return createErrorResponse(msg, 500);
  }
});
