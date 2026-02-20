import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList, getSenderEmail } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

/**
 * Process Session Start
 * 
 * Runs every 15 minutes (via cron job).
 * For each training schedule slot starting now (±15 min window):
 *  - Sends attendance signature requests to all participants (AM and/or PM)
 *  - Notifies the trainer
 * 
 * Only for format_formation = 'intra' or 'inter-entreprises'.
 * Uses session_start_notifications table to prevent duplicate sends.
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
    const baseUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";

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
      .in("trainings.format_formation", ["intra", "inter-entreprises"]);

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

      // Format date for display
      const dateObj = new Date(scheduleDate);
      const formattedDate = dateObj.toLocaleDateString("fr-FR", {
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
        const timeRange = period === "AM"
          ? `${startTimeDisplay} - 12h30`
          : `14h00 - ${endTimeDisplay}`;

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
              <p style="margin: 25px 0;">
                <a href="${signatureUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  ✍️ Signer ma présence
                </a>
              </p>
              <p style="font-size: 12px; color: #666;">
                Cette signature électronique a valeur légale conformément au règlement européen eIDAS.
              </p>
              ${signature}
            `;

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: senderFrom,
                to: [participant.email],
                bcc: bccList,
                subject: `✍️ Émargement – ${training.training_name} – ${formattedDate} ${periodLabel}`,
                html: htmlContent,
              }),
            });

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              console.error(`[process-session-start] Resend error for ${participant.email}:`, errorText);
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

            const trainerResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: senderFrom,
                to: [trainerEmail],
                subject: `📋 Début de session – ${training.training_name} – ${formattedDate} ${periodLabel}`,
                html: trainerHtml,
              }),
            });

            if (trainerResponse.ok) {
              console.log(`[process-session-start] Trainer notified: ${trainerEmail}`);
              totalTrainerNotifications++;
            } else {
              const errorText = await trainerResponse.text();
              console.error(`[process-session-start] Error notifying trainer ${trainerEmail}:`, errorText);
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

    return new Response(
      JSON.stringify({
        success: true,
        sessions_processed: schedules.length,
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
