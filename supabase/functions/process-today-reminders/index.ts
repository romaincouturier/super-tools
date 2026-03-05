import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";

/**
 * Process Today Reminders
 *
 * Runs daily at 06:30 via cron job.
 * For each training starting today (non-permanent, i.e. start_date IS NOT NULL):
 *  - Sends a "C'est aujourd'hui !" email to all participants
 *  - Adapts content to format: présentiel, classe virtuelle, e-learning
 *  - Uses tu/vous templates based on training setting
 *
 * Uses a tracking table column to prevent duplicate sends.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().slice(0, 10);
    console.log(`[process-today-reminders] Checking trainings starting on ${today}`);

    // Fetch all trainings starting today (non-permanent = start_date not null)
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        training_name,
        start_date,
        location,
        format_formation,
        participants_formal_address,
        supports_url
      `)
      .eq("start_date", today)
      .not("start_date", "is", null);

    if (trainingsError) {
      console.error("[process-today-reminders] Error fetching trainings:", trainingsError);
      throw trainingsError;
    }

    if (!trainings || trainings.length === 0) {
      console.log("[process-today-reminders] No trainings starting today");
      return new Response(
        JSON.stringify({ success: true, message: "No trainings starting today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-today-reminders] Found ${trainings.length} training(s) starting today`);

    // Fetch templates
    const { data: templates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content")
      .in("template_type", ["today_reminder_tu", "today_reminder_vous"]);

    const templateMap: Record<string, { subject: string; html_content: string }> = {};
    for (const t of templates || []) {
      templateMap[t.template_type] = { subject: t.subject, html_content: t.html_content };
    }

    const bccList = await getBccList();
    const signatureHtml = await getSigniticSignature();

    let totalSent = 0;

    for (const training of trainings) {
      const trainingId = training.id;

      // Fetch schedules for today to get times
      const { data: schedules } = await supabase
        .from("training_schedules")
        .select("start_time, end_time")
        .eq("training_id", trainingId)
        .eq("day_date", today)
        .order("start_time");

      const scheduleText = (schedules || [])
        .map((s: any) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`)
        .join(" / ");

      // Determine format flags
      const format = training.format_formation || "intra";
      const isPresentiel = format === "intra" || format === "inter-entreprises";
      const isClasseVirtuelle = format === "classe_virtuelle";
      const isElearning = format === "e_learning";

      // Determine tu/vous
      const useFormal = !!training.participants_formal_address;
      const templateKey = useFormal ? "today_reminder_vous" : "today_reminder_tu";
      const template = templateMap[templateKey];

      if (!template) {
        console.warn(`[process-today-reminders] Template ${templateKey} not found, skipping training ${trainingId}`);
        continue;
      }

      // Fetch participants
      const { data: participants } = await supabase
        .from("training_participants")
        .select("id, first_name, email")
        .eq("training_id", trainingId);

      if (!participants || participants.length === 0) {
        console.log(`[process-today-reminders] No participants for training ${trainingId}`);
        continue;
      }

      // Check if today reminder already sent for this training
      const { data: existingLog } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("action_type", "today_reminder_sent")
        .eq("recipient_email", trainingId)
        .gte("created_at", today + "T00:00:00")
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        console.log(`[process-today-reminders] Already sent for training ${trainingId}, skipping`);
        continue;
      }

      let sentCount = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        if (!p.email) continue;

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        const variables: Record<string, string | null | undefined> = {
          first_name: p.first_name || "",
          training_name: training.training_name,
          location: training.location || "",
          schedule: scheduleText || "Horaires à confirmer",
          is_presentiel: isPresentiel ? "1" : undefined,
          is_classe_virtuelle: isClasseVirtuelle ? "1" : undefined,
          is_elearning: isElearning ? "1" : undefined,
        };

        const resolvedSubject = processTemplate(template.subject, variables, false);
        const body = processTemplate(template.html_content, variables, false);
        const resolvedHtml = body
          .split(/\n\n+/)
          .map((paragraph: string) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
          .join("") + "\n" + signatureHtml;

        const result = await sendEmail({
          to: p.email,
          bcc: bccList,
          subject: resolvedSubject,
          html: resolvedHtml,
          _trainingId: trainingId,
          _participantId: p.id,
          _emailType: "today_reminder",
        });

        if (result.success) {
          sentCount++;
          console.log(`[process-today-reminders] Sent to ${p.email}`);
        }
      }

      totalSent += sentCount;

      // Log to prevent duplicates
      try {
        await supabase.from("activity_logs").insert({
          action_type: "today_reminder_sent",
          recipient_email: trainingId,
          details: {
            training_name: training.training_name,
            participants_notified: sentCount,
            format: format,
          },
        });
      } catch (logErr) {
        console.warn("[process-today-reminders] Failed to log:", logErr);
      }
    }

    console.log(`[process-today-reminders] Done. Sent ${totalSent} email(s).`);

    return new Response(
      JSON.stringify({ success: true, trainings_processed: trainings.length, emails_sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[process-today-reminders] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
