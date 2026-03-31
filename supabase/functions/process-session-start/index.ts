import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom, getBccList, getSenderEmail } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

/**
 * Process Session Start
 * 
 * Runs every 15 minutes (via cron job).
 * For each training schedule slot OR live meeting starting now (±15 min window):
 *  - Sends attendance signature requests to all participants (AM and/or PM)
 *  - Notifies the trainer
 * 
 * Excludes e-learning format.
 * Uses session_start_notifications / activity_logs to prevent duplicate sends.
 */

const formatScheduleDisplayDate = (scheduleDate: string) => {
  const dateObj = new Date(`${scheduleDate}T12:00:00`);
  return dateObj.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatDisplayTime = (timeValue: string) => timeValue.slice(0, 5).replace(":", "h");

const buildScheduleTimeRange = (startTime: string, endTime: string, period: "AM" | "PM") => {
  const startHour = parseInt(startTime.slice(0, 2), 10);
  const startMin = parseInt(startTime.slice(3, 5), 10);
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const endMin = parseInt(endTime.slice(3, 5), 10);

  const sessionDurationHours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
  const startTimeDisplay = formatDisplayTime(startTime);
  const endTimeDisplay = formatDisplayTime(endTime);

  if (sessionDurationHours <= 4) {
    return `${startTimeDisplay} - ${endTimeDisplay}`;
  }

  return period === "AM" ? `${startTimeDisplay} - 12h30` : `14h00 - ${endTimeDisplay}`;
};

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabase = getSupabaseClient();
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const baseUrl = urls.app_url;

    const now = new Date();
    
    // Convert everything to Paris time since schedules are stored in French local time
    const parisFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
    const parisTimeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false });
    
    const today = parisFormatter.format(now); // "YYYY-MM-DD" in Paris time
    
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
    const windowStartTime = parisTimeFormatter.format(windowStart); // "HH:MM" in Paris time
    const windowEndTime = parisTimeFormatter.format(now);
    
    // Paris hour/minute for afternoon window check
    const parisHourMin = parisTimeFormatter.format(now).split(":");
    const parisHour = parseInt(parisHourMin[0]);
    const parisMin = parseInt(parisHourMin[1]);

    console.log(`[process-session-start] Checking slots on ${today} (Paris) between ${windowStartTime} and ${windowEndTime}`);

    // Find training schedules that started in the last 15 minutes
    // for intra or inter-entreprises formations
    const { data: schedules, error: schedulesError } = await supabase
      .from("training_schedules")
      .select(`
        id,
        training_id,
        day_date,
        start_time,
        end_time,
        trainings!inner (
          id,
          training_name,
          location,
          format_formation,
          trainer_id,
          trainer_name,
          trainers (
            id,
            email,
            first_name,
            last_name
          )
        )
      `)
      .eq("day_date", today)
      .gte("start_time", windowStartTime + ":00")
      .lte("start_time", windowEndTime + ":59")
      .not("trainings.format_formation", "eq", "elearning");

    if (schedulesError) {
      console.error("[process-session-start] Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    const currentSchedules = schedules ?? [];

    if (currentSchedules.length === 0) {
      console.log("[process-session-start] No sessions starting in the current window");
    } else {
      console.log(`[process-session-start] Found ${currentSchedules.length} starting session(s)`);
    }

    const senderFrom = await getSenderFrom();
    const senderEmail = await getSenderEmail();
    const bccList = await getBccList();
    const signature = await getSigniticSignature();

    let totalSignaturesSent = 0;
    let totalTrainerNotifications = 0;
    let recoveredNotifications = 0;

    const processTrainingSchedulePeriod = async (schedule: any, period: "AM" | "PM") => {
      const training = schedule.trainings as any;
      const trainingId = schedule.training_id;
      const scheduleId = schedule.id;
      const scheduleDate = schedule.day_date;

      try {
        const { data: participants, error: participantsError } = await supabase
          .from("training_participants")
          .select("id, first_name, last_name, email")
          .eq("training_id", trainingId);

        if (participantsError) {
          console.error(`[process-session-start] Error fetching participants for ${trainingId}:`, participantsError);
          return { signaturesSent: 0, trainerNotified: false };
        }

        if (!participants || participants.length === 0) {
          console.log(`[process-session-start] No participants for training ${trainingId}, skipping`);
          return { signaturesSent: 0, trainerNotified: false };
        }

        const { data: existing } = await supabase
          .from("session_start_notifications")
          .select("id, signature_sent_at, trainer_notified_at")
          .eq("training_schedule_id", scheduleId)
          .eq("period", period)
          .maybeSingle();

        if (existing?.signature_sent_at) {
          console.log(`[process-session-start] Already processed ${scheduleId} ${period}, skipping`);
          return { signaturesSent: 0, trainerNotified: false };
        }

        const { error: upsertError } = await supabase
          .from("session_start_notifications")
          .upsert({
            training_schedule_id: scheduleId,
            period,
            participants_count: participants.length,
          }, { onConflict: "training_schedule_id,period" });

        if (upsertError) {
          console.error(`[process-session-start] Error upserting notification record:`, upsertError);
          return { signaturesSent: 0, trainerNotified: false };
        }

        const formattedDate = formatScheduleDisplayDate(scheduleDate);
        const periodLabel = period === "AM" ? "Matin" : "Après-midi";
        const timeRange = buildScheduleTimeRange(schedule.start_time, schedule.end_time, period);

        let pendingSignatureRequests = 0;
        let signaturesSent = 0;

        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          if (!participant.email) continue;

          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          try {
            const { data: existingSignature } = await supabase
              .from("attendance_signatures")
              .select("id, signed_at, token, email_sent_at")
              .eq("training_id", trainingId)
              .eq("participant_id", participant.id)
              .eq("schedule_date", scheduleDate)
              .eq("period", period)
              .maybeSingle();

            if (existingSignature?.signed_at) {
              console.log(`[process-session-start] Skipping ${participant.email} - already signed`);
              continue;
            }

            if (existingSignature?.email_sent_at) {
              console.log(`[process-session-start] Skipping ${participant.email} - request already sent`);
              continue;
            }

            pendingSignatureRequests++;

            let token: string;

            if (existingSignature) {
              token = existingSignature.token;
            } else {
              token = crypto.randomUUID();
              const { error: insertError } = await supabase
                .from("attendance_signatures")
                .insert({
                  training_id: trainingId,
                  participant_id: participant.id,
                  schedule_date: scheduleDate,
                  period,
                  token,
                });

              if (insertError) {
                console.error(`[process-session-start] Error creating signature record for ${participant.email}:`, insertError);
                continue;
              }
            }

            const signatureUrl = `${baseUrl}/emargement/${token}`;
            const firstName = participant.first_name || "";
            const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

            const htmlContent = `
              <p>${greeting}</p>
              <p>Merci de bien vouloir signer ta présence pour la formation <strong>"${training.training_name}"</strong>.</p>
              <ul style="list-style: none; padding: 0; margin: 20px 0;">
                <li>📍 <strong>Lieu :</strong> ${training.location}</li>
                <li>📅 <strong>Date :</strong> ${formattedDate}</li>
                <li>🕐 <strong>Horaire :</strong> ${periodLabel} (${timeRange})</li>
              </ul>
              ${emailButton("✍️ Signer ma présence", signatureUrl)}
              <p style="font-size: 12px; color: #666;">
                Cette signature électronique a valeur légale conformément au règlement européen eIDAS.
              </p>
              ${signature}
            `;

            const result = await sendEmail({
              from: senderFrom,
              to: [participant.email],
              bcc: bccList,
              subject: `✍️ Émargement – ${training.training_name} – ${formattedDate} ${periodLabel}`,
              html: htmlContent,
              _emailType: "attendance_signature_auto",
              _trainingId: trainingId,
              _participantId: participant.id,
            });

            if (!result.success) {
              console.error(`[process-session-start] sendEmail error for ${participant.email}:`, result.error);
              continue;
            }

            await supabase
              .from("attendance_signatures")
              .update({ email_sent_at: new Date().toISOString() })
              .eq("training_id", trainingId)
              .eq("participant_id", participant.id)
              .eq("schedule_date", scheduleDate)
              .eq("period", period);

            console.log(`[process-session-start] Signature request sent to ${participant.email}`);
            signaturesSent++;
          } catch (err) {
            console.error(`[process-session-start] Error processing participant ${participant.email}:`, err);
          }
        }

        const trainerData = training.trainers as any;
        const trainerEmail = trainerData?.email || null;
        const trainerFirstName = trainerData?.first_name || training.trainer_name || "Formateur";
        let trainerNotified = false;

        if (trainerEmail && !existing?.trainer_notified_at) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 300));

            const trainerHtml = `
              <p>Bonjour ${trainerFirstName},</p>
              <p>La session <strong>${periodLabel}</strong> de la formation <strong>"${training.training_name}"</strong> vient de démarrer.</p>
              <ul style="list-style: none; padding: 0; margin: 20px 0;">
                <li>📍 <strong>Lieu :</strong> ${training.location}</li>
                <li>📅 <strong>Date :</strong> ${formattedDate}</li>
                <li>🕐 <strong>Horaire :</strong> ${periodLabel} (${timeRange})</li>
                <li>👥 <strong>Participants :</strong> ${signaturesSent} demande(s) d'émargement envoyée(s)</li>
              </ul>
              <p style="font-size: 13px; color: #666;">
                Les participants ont reçu leur lien de signature électronique par email.
              </p>
              ${signature}
            `;

            const trainerResult = await sendEmail({
              from: senderFrom,
              to: [trainerEmail],
              bcc: bccList,
              subject: `📋 Début de session – ${training.training_name} – ${formattedDate} ${periodLabel}`,
              html: trainerHtml,
              _emailType: "session_start_trainer",
              _trainingId: trainingId,
            });

            if (trainerResult.success) {
              console.log(`[process-session-start] Trainer notified: ${trainerEmail}`);
              trainerNotified = true;
            } else {
              console.error(`[process-session-start] Error notifying trainer ${trainerEmail}:`, trainerResult.error);
            }
          } catch (err) {
            console.error(`[process-session-start] Error sending trainer notification:`, err);
          }
        } else if (!trainerEmail) {
          console.warn(`[process-session-start] No trainer email for training ${trainingId}`);
        }

        const fullyProcessed = pendingSignatureRequests === signaturesSent;

        await supabase
          .from("session_start_notifications")
          .update({
            signature_sent_at: fullyProcessed ? new Date().toISOString() : null,
            trainer_notified_at: existing?.trainer_notified_at || (trainerNotified ? new Date().toISOString() : null),
          })
          .eq("training_schedule_id", scheduleId)
          .eq("period", period);

        if (!fullyProcessed) {
          console.warn(`[process-session-start] Partial send for ${scheduleId} ${period}: ${signaturesSent}/${pendingSignatureRequests}`);
        }

        try {
          await supabase.from("activity_logs").insert({
            action_type: "session_start_processed",
            recipient_email: senderEmail,
            details: {
              training_id: trainingId,
              training_name: training.training_name,
              schedule_date: scheduleDate,
              period,
              signatures_sent: signaturesSent,
              trainer_notified: !!(existing?.trainer_notified_at || trainerNotified),
              fully_processed: fullyProcessed,
            },
          });
        } catch (logError) {
          console.warn("[process-session-start] Failed to log activity:", logError);
        }

        return { signaturesSent, trainerNotified };
      } catch (error) {
        console.error(`[process-session-start] Error while processing schedule ${scheduleId} ${period}:`, error);
        return { signaturesSent: 0, trainerNotified: false };
      }
    };

    for (const schedule of currentSchedules) {
      const startHour = parseInt(schedule.start_time.slice(0, 2), 10);
      const period = startHour < 13 ? "AM" : "PM";
      const result = await processTrainingSchedulePeriod(schedule, period);
      totalSignaturesSent += result.signaturesSent;
      if (result.trainerNotified) totalTrainerNotifications++;
    }

    const { data: pendingNotifications, error: pendingNotificationsError } = await supabase
      .from("session_start_notifications")
      .select("training_schedule_id, period")
      .is("signature_sent_at", null);

    if (pendingNotificationsError) {
      console.error("[process-session-start] Error fetching pending notifications:", pendingNotificationsError);
    } else {
      const pendingScheduleIds = [...new Set((pendingNotifications ?? []).map((item) => item.training_schedule_id))];

      if (pendingScheduleIds.length > 0) {
        const { data: pendingSchedules, error: pendingSchedulesError } = await supabase
          .from("training_schedules")
          .select(`
            id,
            training_id,
            day_date,
            start_time,
            end_time,
            trainings!inner (
              id,
              training_name,
              location,
              format_formation,
              trainer_id,
              trainer_name,
              trainers (
                id,
                email,
                first_name,
                last_name
              )
            )
          `)
          .in("id", pendingScheduleIds)
          .eq("day_date", today)
          .not("trainings.format_formation", "eq", "elearning");

        if (pendingSchedulesError) {
          console.error("[process-session-start] Error fetching schedules for pending notifications:", pendingSchedulesError);
        } else {
          const pendingScheduleMap = new Map((pendingSchedules ?? []).map((schedule) => [schedule.id, schedule]));

          for (const pending of pendingNotifications ?? []) {
            if (pending.period !== "AM" && pending.period !== "PM") continue;

            const schedule = pendingScheduleMap.get(pending.training_schedule_id);
            if (!schedule) continue;

            console.log(`[process-session-start] Recovering pending ${pending.period} for schedule ${pending.training_schedule_id}`);
            const result = await processTrainingSchedulePeriod(schedule, pending.period);
            totalSignaturesSent += result.signaturesSent;
            if (result.trainerNotified) totalTrainerNotifications++;
            recoveredNotifications++;
          }
        }
      }
    }

    // =============================================
    // PART 1b: Send PM for full-day sessions at ~14:00
    // For schedules that started in the morning but have PM periods,
    // trigger PM sending when current time is around 14:00 (13:45–14:15)
    // =============================================
    // Use parisHour/parisMin computed at the top
    const isAfternoonWindow = (parisHour === 13 && parisMin >= 45) || (parisHour === 14 && parisMin <= 15);

    if (isAfternoonWindow) {
      console.log(`[process-session-start] Checking for full-day PM slots at ${parisHour}:${parisMin}`);

      // Find today's schedules that span both AM and PM (start before 13, end after 13)
      const { data: fullDaySchedules } = await supabase
        .from("training_schedules")
        .select(`
          id,
          training_id,
          day_date,
          start_time,
          end_time,
          trainings!inner (
            id,
            training_name,
            location,
            format_formation,
            trainer_id,
            trainer_name,
            trainers (
              id,
              email,
              first_name,
              last_name
            )
          )
        `)
        .eq("day_date", today)
        .lt("start_time", "13:00:00")
        .gt("end_time", "13:00:00")
        .not("trainings.format_formation", "eq", "elearning");

      if (fullDaySchedules && fullDaySchedules.length > 0) {
        console.log(`[process-session-start] Found ${fullDaySchedules.length} full-day schedule(s) needing PM`);

        for (const schedule of fullDaySchedules) {
          const result = await processTrainingSchedulePeriod(schedule, "PM");
          totalSignaturesSent += result.signaturesSent;
          if (result.trainerNotified) totalTrainerNotifications++;
        }
      }
    }

    //
    // PART 2: Process live meetings starting now
    // =============================================
    let livesProcessed = 0;

    try {
      // Build Paris-local ISO range for the 15-min window
      const parisDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
      const parisWindowStart = `${parisDate}T${windowStartTime}:00+01:00`;
      const parisWindowEnd = `${parisDate}T${windowEndTime}:59+01:00`;

      // Use UTC-based range instead for reliability
      const utcWindowStart = windowStart.toISOString();
      const utcWindowEnd = windowEnd.toISOString();

      const { data: liveMeetings, error: livesError } = await supabase
        .from("training_live_meetings")
        .select(`
          id,
          title,
          scheduled_at,
          training_id,
          trainings!inner (
            id,
            training_name,
            location,
            format_formation,
            trainer_id,
            trainer_name,
            participants_formal_address,
            trainers (
              id,
              email,
              first_name,
              last_name
            )
          )
        `)
        .gte("scheduled_at", utcWindowStart)
        .lte("scheduled_at", utcWindowEnd)
        .neq("status", "cancelled");

      if (livesError) {
        console.error("[process-session-start] Error fetching lives:", livesError);
      } else if (liveMeetings && liveMeetings.length > 0) {
        console.log(`[process-session-start] Found ${liveMeetings.length} live(s) starting now`);

        for (const live of liveMeetings) {
          const training = live.trainings as any;
          const trainingId = live.training_id;
          const liveId = live.id;

          // Skip e-learning
          if (training.format_formation === "elearning") continue;

          // Determine date and period from scheduled_at
          const liveDate = new Date(live.scheduled_at);
          const liveHour = parseInt(liveDate.toLocaleTimeString("en-US", { timeZone: "Europe/Paris", hour12: false, hour: "2-digit" }));
          const period = liveHour < 13 ? "AM" : "PM";
          const scheduleDate = liveDate.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

          // Dedup using activity_logs
          const dedupKey = `session_start_live:${liveId}:${period}`;
          const { data: existingLog } = await supabase
            .from("activity_logs")
            .select("id")
            .eq("action_type", "session_start_live_processed")
            .eq("recipient_email", dedupKey)
            .limit(1);

          if (existingLog && existingLog.length > 0) {
            console.log(`[process-session-start] Live ${liveId} ${period} already processed, skipping`);
            continue;
          }

          // Format date for display
          const dateObj = new Date(scheduleDate + "T12:00:00");
          const formattedDate = dateObj.toLocaleDateString("fr-FR", {
            timeZone: "Europe/Paris",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const liveTime = liveDate.toLocaleTimeString("fr-FR", {
            timeZone: "Europe/Paris",
            hour: "2-digit",
            minute: "2-digit",
          });
          const periodLabel = period === "AM" ? "Matin" : "Après-midi";

          // Fetch participants
          const { data: participants } = await supabase
            .from("training_participants")
            .select("id, first_name, last_name, email")
            .eq("training_id", trainingId);

          if (!participants || participants.length === 0) {
            console.log(`[process-session-start] No participants for live training ${trainingId}`);
            continue;
          }

          let liveSignaturesSent = 0;

          for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            if (!participant.email) continue;

            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));

            try {
              // Check existing signature
              const { data: existingSig } = await supabase
                .from("attendance_signatures")
                .select("id, signed_at, token, email_sent_at")
                .eq("training_id", trainingId)
                .eq("participant_id", participant.id)
                .eq("schedule_date", scheduleDate)
                .eq("period", period)
                .maybeSingle();

              if (existingSig?.signed_at || existingSig?.email_sent_at) continue;

              let token: string;
              if (existingSig) {
                token = existingSig.token;
              } else {
                token = crypto.randomUUID();
                const { error: insertErr } = await supabase
                  .from("attendance_signatures")
                  .insert({
                    training_id: trainingId,
                    participant_id: participant.id,
                    schedule_date: scheduleDate,
                    period,
                    token,
                  });
                if (insertErr) {
                  console.error(`[process-session-start] Error creating sig for ${participant.email}:`, insertErr);
                  continue;
                }
              }

              const signatureUrl = `${baseUrl}/emargement/${token}`;
              const firstName = participant.first_name || "";
              const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

              const htmlContent = `
                <p>${greeting}</p>
                <p>Merci de bien vouloir signer ta présence pour la formation <strong>"${training.training_name}"</strong>.</p>
                <ul style="list-style: none; padding: 0; margin: 20px 0;">
                  <li>📺 <strong>Live :</strong> ${live.title || "Session live"}</li>
                  <li>📅 <strong>Date :</strong> ${formattedDate} à ${liveTime}</li>
                </ul>
                ${emailButton("✍️ Signer ma présence", signatureUrl)}
                <p style="font-size: 12px; color: #666;">
                  Cette signature électronique a valeur légale conformément au règlement européen eIDAS.
                </p>
                ${signature}
              `;

              const result = await sendEmail({
                from: senderFrom,
                to: [participant.email],
                bcc: bccList,
                subject: `✍️ Émargement – ${training.training_name} – ${formattedDate}`,
                html: htmlContent,
                _emailType: "attendance_signature_auto_live",
                _trainingId: trainingId,
                _participantId: participant.id,
              });

              if (result.success) {
                await supabase
                  .from("attendance_signatures")
                  .update({ email_sent_at: new Date().toISOString() })
                  .eq("training_id", trainingId)
                  .eq("participant_id", participant.id)
                  .eq("schedule_date", scheduleDate)
                  .eq("period", period);
                liveSignaturesSent++;
                console.log(`[process-session-start] Live sig request sent to ${participant.email}`);
              }
            } catch (err) {
              console.error(`[process-session-start] Error processing live participant ${participant.email}:`, err);
            }
          }

          totalSignaturesSent += liveSignaturesSent;
          livesProcessed++;

          // Log dedup
          try {
            await supabase.from("activity_logs").insert({
              action_type: "session_start_live_processed",
              recipient_email: dedupKey,
              details: {
                training_id: trainingId,
                training_name: training.training_name,
                live_id: liveId,
                live_title: live.title,
                schedule_date: scheduleDate,
                period,
                signatures_sent: liveSignaturesSent,
              },
            });
          } catch (logErr) {
            console.warn("[process-session-start] Failed to log live processing:", logErr);
          }
        }
      }
    } catch (liveErr) {
      console.error("[process-session-start] Error processing lives:", liveErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessions_processed: currentSchedules.length,
        recovered_notifications: recoveredNotifications,
        lives_processed: livesProcessed,
        signatures_sent: totalSignaturesSent,
        trainer_notifications: totalTrainerNotifications,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[process-session-start] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
