import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { processTemplate, emailButton, templateTextToHtml } from "../_shared/templates.ts";
import { tuVousSuffix, fetchTemplateOrDefault, logEmailActivity } from "../_shared/email-helpers.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

/**
 * Process Today Reminders
 *
 * Runs daily at 06:30 via cron job.
 * For each training that has a scheduled session TODAY (via training_schedules):
 *  - Sends a reminder email to all participants
 *  - Adapts content to format: présentiel, classe virtuelle, e-learning
 *  - Uses tu/vous templates based on training setting
 *
 * Uses activity_logs to prevent duplicate sends per training per day.
 */

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();

    // Use Paris timezone for "today"
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    console.log(`[process-today-reminders] Checking sessions scheduled on ${today}`);

    // Find all training_schedules for today → get distinct training IDs
    const { data: todaySchedules, error: schedulesError } = await supabase
      .from("training_schedules")
      .select("training_id, start_time, end_time")
      .eq("day_date", today)
      .order("start_time");

    if (schedulesError) {
      console.error("[process-today-reminders] Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    if (!todaySchedules || todaySchedules.length === 0) {
      console.log("[process-today-reminders] No sessions scheduled today");
      return new Response(
        JSON.stringify({ success: true, message: "No sessions scheduled today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group schedules by training_id
    const schedulesByTraining = new Map<string, Array<{ start_time: string; end_time: string }>>();
    for (const s of todaySchedules) {
      if (!schedulesByTraining.has(s.training_id)) {
        schedulesByTraining.set(s.training_id, []);
      }
      schedulesByTraining.get(s.training_id)!.push({ start_time: s.start_time, end_time: s.end_time });
    }

    const trainingIds = Array.from(schedulesByTraining.keys());
    console.log(`[process-today-reminders] Found ${trainingIds.length} training(s) with sessions today`);

    // Fetch training details for all relevant trainings
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        training_name,
        start_date,
        location,
        format_formation,
        participants_formal_address,
        supports_url,
        trainer_id
      `)
      .in("id", trainingIds);

    if (trainingsError) {
      console.error("[process-today-reminders] Error fetching trainings:", trainingsError);
      throw trainingsError;
    }

    if (!trainings || trainings.length === 0) {
      console.log("[process-today-reminders] No matching trainings found");
      return new Response(
        JSON.stringify({ success: true, message: "No matching trainings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch templates (participant tu/vous + trainer) using shared helper
    const [templateTu, templateVous, trainerTemplateData] = await Promise.all([
      fetchTemplateOrDefault(supabase, "today_reminder_tu", "", ""),
      fetchTemplateOrDefault(supabase, "today_reminder_vous", "", ""),
      fetchTemplateOrDefault(supabase, "trainer_today_reminder", "", ""),
    ]);

    const templateMap: Record<string, { subject: string; content: string }> = {
      today_reminder_tu: templateTu,
      today_reminder_vous: templateVous,
      trainer_today_reminder: trainerTemplateData,
    };

    // Build trainer lookup for all trainings that have a trainer_id
    const trainerIds = [...new Set(trainings.filter((t: any) => t.trainer_id).map((t: any) => t.trainer_id))];
    const trainerMap: Record<string, { first_name: string; email: string }> = {};
    if (trainerIds.length > 0) {
      const { data: trainerRows } = await supabase
        .from("trainers")
        .select("id, first_name, email")
        .in("id", trainerIds);
      for (const tr of trainerRows || []) {
        trainerMap[tr.id] = { first_name: tr.first_name || "", email: tr.email || "" };
      }
    }

    const bccList = await getBccList();
    const signatureHtml = await getSigniticSignature();
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    let totalSent = 0;

    for (const training of trainings) {
      const trainingId = training.id;

      // Check if already sent today for this training
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

      // Build schedule text from grouped data
      const schedules = schedulesByTraining.get(trainingId) || [];
      const scheduleText = schedules
        .map((s) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`)
        .join(" / ");

      // Determine format flags
      const format = training.format_formation || "intra";
      const isPresentiel = format === "intra" || format === "inter-entreprises";
      const isClasseVirtuelle = format === "classe_virtuelle";
      const isElearning = format === "e_learning";

      // Determine if this is the first scheduled day
      const { data: allSchedules } = await supabase
        .from("training_schedules")
        .select("day_date")
        .eq("training_id", trainingId)
        .order("day_date")
        .limit(1);
      const firstDate = allSchedules && allSchedules.length > 0 ? allSchedules[0].day_date : today;
      const isFirstDay = today === firstDate;

      // For virtual trainings, fetch the meeting URL from live meetings scheduled today
      let meetingUrl = "";
      if (isClasseVirtuelle || isElearning) {
        const { data: liveMeetings } = await supabase
          .from("training_live_meetings")
          .select("meeting_url")
          .eq("training_id", trainingId)
          .gte("scheduled_at", today + "T00:00:00")
          .lte("scheduled_at", today + "T23:59:59")
          .neq("status", "cancelled")
          .limit(1);

        if (liveMeetings && liveMeetings.length > 0 && liveMeetings[0].meeting_url) {
          meetingUrl = liveMeetings[0].meeting_url;
        }
        // Fallback: if location looks like a URL, use it as meeting URL
        if (!meetingUrl && training.location && /^https?:\/\//i.test(training.location)) {
          meetingUrl = training.location;
        }
      }

      // Determine tu/vous using shared helper
      const templateKey = `today_reminder_${tuVousSuffix(!!training.participants_formal_address)}`;
      const template = templateMap[templateKey];

      if (!template || !template.subject) {
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

      // Per-participant dedup: check which participants already received today
      const participantLogKeys = participants.filter((p: any) => p.email).map((p: any) => `${trainingId}:${p.id}`);
      const { data: existingParticipantLogs } = participantLogKeys.length > 0
        ? await supabase
            .from("activity_logs")
            .select("recipient_email")
            .eq("action_type", "today_reminder_participant_sent")
            .in("recipient_email", participantLogKeys)
            .gte("created_at", today + "T00:00:00")
        : { data: [] as { recipient_email: string }[] };
      const alreadySentParticipants = new Set(
        (existingParticipantLogs || []).map((row: any) => row.recipient_email)
      );

      let sentCount = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        if (!p.email) continue;

        const participantLogKey = `${trainingId}:${p.id}`;
        if (alreadySentParticipants.has(participantLogKey)) {
          continue;
        }

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
          meeting_url: meetingUrl || undefined,
          is_first_day: isFirstDay ? "1" : undefined,
          is_next_day: !isFirstDay ? "1" : undefined,
        };

        const summaryUrl = `${APP_URL}/formation-info/${trainingId}`;
        const resolvedSubject = processTemplate(template.subject, variables, false);
        const body = processTemplate(template.content, variables, false);
        const resolvedHtml = templateTextToHtml(body)
          + "\n" + emailButton("Infos & documents de la formation", summaryUrl)
          + "\n" + signatureHtml;

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
          alreadySentParticipants.add(participantLogKey);
          console.log(`[process-today-reminders] Sent to ${p.email}`);

          await logEmailActivity(supabase, "today_reminder_participant_sent", participantLogKey, {
            training_id: trainingId,
            training_name: training.training_name,
            participant_id: p.id,
            participant_email: p.email,
          });
        }
      }

      totalSent += sentCount;

      // ── Trainer reminder ──────────────────────────────────────────
      const trainerTemplate = templateMap["trainer_today_reminder"];
      const trainer = training.trainer_id ? trainerMap[training.trainer_id] : null;

      if (trainerTemplate?.subject && trainer?.email) {
        // Check if trainer reminder already sent
        const { data: trainerLog } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("action_type", "trainer_today_reminder_sent")
          .eq("recipient_email", trainer.email)
          .gte("created_at", today + "T00:00:00")
          .limit(1);

        if (!trainerLog || trainerLog.length === 0) {
          // Determine if attendance signatures exist for this training (= attendance is applicable)
          const { count: attendanceCount } = await supabase
            .from("attendance_signatures")
            .select("id", { count: "exact", head: true })
            .eq("training_id", trainingId);

          const hasAttendance = (attendanceCount || 0) > 0;

          const trainerVars: Record<string, string | null | undefined> = {
            trainer_first_name: trainer.first_name || "",
            training_name: training.training_name,
            schedule: scheduleText || "Horaires à confirmer",
            meeting_url: meetingUrl || undefined,
            has_attendance: hasAttendance ? "1" : undefined,
          };

          const trainerSummaryUrl = `${APP_URL}/formation-info/${trainingId}`;
          const trainerSubject = processTemplate(trainerTemplate.subject, trainerVars, false);
          const trainerBody = processTemplate(trainerTemplate.content, trainerVars, false);
          const trainerHtml = templateTextToHtml(trainerBody)
            + "\n" + emailButton("Infos & documents de la formation", trainerSummaryUrl)
            + "\n" + signatureHtml;

          const trainerResult = await sendEmail({
            to: trainer.email,
            bcc: bccList,
            subject: trainerSubject,
            html: trainerHtml,
            _trainingId: trainingId,
            _emailType: "trainer_today_reminder",
          });

          if (trainerResult.success) {
            totalSent++;
            console.log(`[process-today-reminders] Trainer reminder sent to ${trainer.email}`);
          }

          await logEmailActivity(supabase, "trainer_today_reminder_sent", trainer.email, {
            training_id: trainingId,
            training_name: training.training_name,
            session_date: today,
          });
        }
      }

      // Log training-level reminder to prevent duplicates
      await logEmailActivity(supabase, "today_reminder_sent", trainingId, {
        training_name: training.training_name,
        participants_notified: sentCount,
        format: format,
        session_date: today,
      });
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
