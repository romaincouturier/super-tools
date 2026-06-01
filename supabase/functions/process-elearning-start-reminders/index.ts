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

// Send a friendly J+5 reminder to paying e-learning participants who haven't started (0% progress).
// Idempotent: skip if elearning_start_reminder already logged for this participant.

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const signature = await getSigniticSignature();

    // E-learning trainings only
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, supports_lms_course_id, supertilt_link, location, sponsor_formal_address, woocommerce_product_id, catalog_id, status")
      .eq("format_formation", "e_learning");

    if (trainingsError) {
      console.error("Error fetching e-learning trainings:", trainingsError);
      return createErrorResponse(trainingsError.message, 500);
    }

    if (!trainings || trainings.length === 0) {
      return createJsonResponse({ success: true, processed: 0, sent: 0, message: "No e-learning trainings" });
    }

    // Cart base URL (for access_link building)
    const { data: cartBaseUrlSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "woocommerce_cart_base_url")
      .maybeSingle();
    const cartBaseUrl = cartBaseUrlSetting?.setting_value;

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

      // Build access link (same logic as send-elearning-access)
      let accessLink = training.supertilt_link || training.location || "";
      if (cartBaseUrl) {
        let productId: number | null = null;
        if (p.formula && training.catalog_id) {
          const { data: formula } = await supabase
            .from("formation_formulas")
            .select("woocommerce_product_id")
            .eq("formation_config_id", training.catalog_id)
            .ilike("name", p.formula)
            .maybeSingle();
          if (formula?.woocommerce_product_id) productId = formula.woocommerce_product_id;
        }
        if (!productId && training.woocommerce_product_id) productId = training.woocommerce_product_id;
        if (!productId && training.catalog_id) {
          const { data: cfg } = await supabase
            .from("formation_configs")
            .select("woocommerce_product_id")
            .eq("id", training.catalog_id)
            .maybeSingle();
          if (cfg?.woocommerce_product_id) productId = cfg.woocommerce_product_id;
        }
        if (productId) accessLink = `${cartBaseUrl}${productId}`;
      }

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
