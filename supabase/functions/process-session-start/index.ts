import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList, getSenderEmail } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const baseUrl = urls.app_url;

    const now = new Date();
    // Window: from 15 minutes ago to now (so we catch any slot that started in the last 15 min)
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
    const windowEnd = now;

    const windowStartTime = windowStart.toTimeString().slice(0, 5); // "HH:MM"
    const windowEndTime = windowEnd.toTimeString().slice(0, 5);
    const today = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    console.log(`[process-session-start] Checking slots on ${today} between ${windowStartTime} and ${windowEndTime}`);

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

    if (!schedules || schedules.length === 0) {
      console.log("[process-session-start] No sessions starting now");
      return new Response(
        JSON.stringify({ success: true, message: "No sessions starting now" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-session-start] Found ${schedules.length} starting session(s)`);

    const senderFrom = await getSenderFrom();
    const senderEmail = await getSenderEmail();
    const bccList = await getBccList();
    const signature = await getSigniticSignature();

    let totalSignaturesSent = 0;
    let totalTrainerNotifications = 0;

    for (const schedule of schedules) {
      const training = schedule.trainings as any;
      const trainingId = schedule.training_id;
      const scheduleId = schedule.id;
      const scheduleDate = schedule.day_date;

      // Determine which periods this slot covers
      const startHour = parseInt(schedule.start_time.slice(0, 2));
      const endHour = parseInt(schedule.end_time.slice(0, 2));
      const endMin = parseInt(schedule.end_time.slice(3, 5));

      const hasAM = startHour < 13;
      const hasPM = endHour > 13 || (endHour === 13 && endMin > 0);

      const periodsToProcess: string[] = [];
      if (hasAM) periodsToProcess.push("AM");
      if (hasPM) periodsToProcess.push("PM");

      // Format date for display — add T12:00 to avoid UTC date shift
      const dateObj = new Date(scheduleDate + "T12:00:00");
      const formattedDate = dateObj.toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const startTimeDisplay = schedule.start_time.slice(0, 5).replace(":", "h");
      const endTimeDisplay = schedule.end_time.slice(0, 5).replace(":", "h");

      // Fetch participants for this training
      const { data: participants } = await supabase
        .from("training_participants")
        .select("id, first_name, last_name, email")
        .eq("training_id", trainingId);

      if (!participants || participants.length === 0) {
        console.log(`[process-session-start] No participants for training ${trainingId}, skipping`);
        continue;
      }

      // Process each period
      for (const period of periodsToProcess) {
        // Check if already processed (prevent duplicate sends)
        const { data: existing } = await supabase
          .from("session_start_notifications")
          .select("id, signature_sent_at")
          .eq("training_schedule_id", scheduleId)
          .eq("period", period)
          .maybeSingle();

        if (existing?.signature_sent_at) {
          console.log(`[process-session-start] Already processed ${scheduleId} ${period}, skipping`);
          continue;
        }

        // Reserve the slot (upsert) to prevent race conditions
        const { error: upsertError } = await supabase
          .from("session_start_notifications")
          .upsert({
            training_schedule_id: scheduleId,
            period,
            participants_count: participants.length,
          }, { onConflict: "training_schedule_id,period" });

        if (upsertError) {
          console.error(`[process-session-start] Error upserting notification record:`, upsertError);
          continue;
        }

        const periodLabel = period === "AM" ? "Matin" : "Après-midi";
        const sessionDurationHours = ((endHour * 60 + endMin) - (startHour * 60 + parseInt(schedule.start_time.slice(3, 5)))) / 60;
        const timeRange = sessionDurationHours <= 4
          ? `${startTimeDisplay} - ${endTimeDisplay}`
          : (period === "AM" ? `${startTimeDisplay} - 12h30` : `14h00 - ${endTimeDisplay}`);

        // =============================================
        // 1. Send signature requests to all participants
        // =============================================
        let signaturesSent = 0;

        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];

          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          try {
            // Check if signature record already exists
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

            // Update email_sent_at after successful send
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

        totalSignaturesSent += signaturesSent;

        // =============================================
        // 2. Notify the trainer
        // =============================================
        const trainerData = training.trainers as any;
        const trainerEmail = trainerData?.email || null;
        const trainerFirstName = trainerData?.first_name || training.trainer_name || "Formateur";

        if (trainerEmail) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300));

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
              totalTrainerNotifications++;
            } else {
              console.error(`[process-session-start] Error notifying trainer ${trainerEmail}:`, trainerResult.error);
            }
          } catch (err) {
            console.error(`[process-session-start] Error sending trainer notification:`, err);
          }
        } else {
          console.warn(`[process-session-start] No trainer email for training ${trainingId}`);
        }

        // Mark as processed
        await supabase
          .from("session_start_notifications")
          .update({
            signature_sent_at: new Date().toISOString(),
            trainer_notified_at: trainerEmail ? new Date().toISOString() : null,
          })
          .eq("training_schedule_id", scheduleId)
          .eq("period", period);

        // Log activity
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
              trainer_notified: !!trainerEmail,
            },
          });
        } catch (logError) {
          console.warn("[process-session-start] Failed to log activity:", logError);
        }
      }
    }

    // =============================================
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
        sessions_processed: schedules.length,
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
