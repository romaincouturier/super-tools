import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  replaceVariables,
  getSupabaseClient,
  sendEmail,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

// Send a friendly J+5 reminder to paying e-learning participants who haven't started (0% progress).
// Idempotent: skip if elearning_start_reminder already logged for this participant.

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const signature = await getSigniticSignature();

    // E-learning trainings only
    const { data: allTrainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, supports_lms_course_id, supertilt_link, location, sponsor_formal_address, catalog_id, is_cancelled")
      .eq("format_formation", "e_learning");

    if (trainingsError) {
      console.error("Error fetching e-learning trainings:", trainingsError);
      return createErrorResponse(trainingsError.message, 500);
    }

    // Only sessions that have actually started (start_date <= today) or permanent sessions (no start_date).
    // A learner enrolled in a session starting in November must not be nudged to "start now".
    const todayIso = new Date().toISOString().slice(0, 10);
    const trainings = (allTrainings || []).filter(
      (t: any) => !t.is_cancelled && (!t.start_date || t.start_date <= todayIso),
    );

    if (trainings.length === 0) {
      return createJsonResponse({ success: true, processed: 0, sent: 0, message: "No e-learning trainings" });
    }


    // Access link = personal magic link to the SuperTools learner portal (built per participant below).



    const trainingIds = trainings.map((t) => t.id);

    // Participants: online (paying), registered >= 5 days ago
    const cutoffIso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: participants, error: pError } = await supabase
      .from("training_participants")
      .select("id, training_id, first_name, last_name, email, payment_mode, added_at, formula")
      .in("training_id", trainingIds)
      .eq("payment_mode", "online")
      .lte("added_at", cutoffIso);

    if (pError) {
      console.error("Error fetching participants:", pError);
      return createErrorResponse(pError.message, 500);
    }

    if (!participants || participants.length === 0) {
      return createJsonResponse({ success: true, processed: 0, sent: 0, message: "No eligible participants" });
    }

    // Already-sent set
    const participantIds = participants.map((p) => p.id);
    const { data: alreadySent } = await supabase
      .from("sent_emails_log")
      .select("participant_id")
      .eq("email_type", "elearning_start_reminder")
      .in("participant_id", participantIds);
    const alreadySentSet = new Set((alreadySent || []).map((r: any) => r.participant_id));

    // Templates (one fetch)
    const { data: templates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content, is_default")
      .in("template_type", ["elearning_start_reminder_tu", "elearning_start_reminder_vous"])
      .order("is_default", { ascending: false });

    const pickTemplate = (type: string) => templates?.find((t: any) => t.template_type === type);

    const trainingsById = new Map<string, any>();
    for (const t of trainings) trainingsById.set(t.id, t);

    let sent = 0;
    let skipped = 0;
    let processed = 0;

    for (const p of participants) {
      processed++;
      if (alreadySentSet.has(p.id)) { skipped++; continue; }

      const training = trainingsById.get(p.training_id);
      if (!training) { skipped++; continue; }

      // 0% progress check via enrollment, fallback to no progress rows
      let isZero = true;
      const courseId = training.supports_lms_course_id;
      const learnerEmail = (p.email || "").toLowerCase();

      if (courseId && learnerEmail) {
        const { data: enrollment } = await supabase
          .from("lms_enrollments")
          .select("completion_percentage")
          .eq("course_id", courseId)
          .eq("learner_email", learnerEmail)
          .maybeSingle();

        if (enrollment && Number(enrollment.completion_percentage || 0) > 0) {
          isZero = false;
        } else {
          // Double-check via lms_progress: any started/completed lesson means non-zero
          const { count: progressCount } = await supabase
            .from("lms_progress")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId)
            .eq("learner_email", learnerEmail)
            .in("status", ["in_progress", "completed"]);

          if ((progressCount || 0) > 0) isZero = false;
        }
      }

      if (!isZero) { skipped++; continue; }

      // Pick template
      const isTu = !training.sponsor_formal_address;
      const template = pickTemplate(isTu ? "elearning_start_reminder_tu" : "elearning_start_reminder_vous");
      if (!template) { skipped++; continue; }

      // Access link: personal magic link to the SuperTools learner portal (valid 1 year).
      // Never a WooCommerce cart URL, never a generic page: the participant has already paid.
      const urls = await getAppUrls();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      const { data: magicLink, error: magicErr } = await supabase
        .from("learner_magic_links")
        .insert({
          email: learnerEmail,
          training_id: training.id,
          expires_at: expiresAt.toISOString(),
        })
        .select("token")
        .single();

      if (magicErr || !magicLink) {
        console.error(`Magic link generation failed for ${p.email}:`, magicErr?.message);
        skipped++;
        continue;
      }

      const accessLink = `${urls.app_url}/apprenant/connexion?token=${magicLink.token}`;



      const variables: Record<string, string> = {
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        training_name: training.training_name || "",
        access_link: accessLink,
      };

      const subject = replaceVariables(template.subject, variables);
      const content = replaceVariables(template.html_content, variables);

      // Plain-text -> HTML paragraphs
      const formatted = content.split(/\n\n+/).map((b) => {
        const t = b.trim();
        if (!t) return "";
        if (/^<(p|div|table|ol|ul|h[1-6])\b/i.test(t)) return t;
        return `<p>${t.split(/\n/).map((l) => l.trim()).join("<br>")}</p>`;
      }).filter(Boolean).join("\n");

      const html = `${formatted}\n${signature}`;

      const bccList = await getBccList();
      const result = await sendEmail({
        to: [p.email],
        bcc: bccList,
        subject,
        html,
        _emailType: "elearning_start_reminder",
        _trainingId: training.id,
        _participantId: p.id,
      } as any);

      if (result.success) {
        sent++;
        console.log(`elearning_start_reminder sent to ${p.email} (training ${training.id})`);
      } else {
        console.error(`Failed elearning_start_reminder for ${p.email}:`, result.error);
      }

      // small delay to respect rate limit
      await new Promise((r) => setTimeout(r, 400));
    }

    return createJsonResponse({ success: true, processed, sent, skipped });
  } catch (error: unknown) {
    console.error("Error in process-elearning-start-reminders:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, 500);
  }
});
