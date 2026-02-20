import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, scheduleDate, period } = await req.json();

    if (!trainingId || !scheduleDate || !period) {
      return new Response(
        JSON.stringify({ error: "trainingId, scheduleDate, and period are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!["AM", "PM"].includes(period)) {
      return new Response(
        JSON.stringify({ error: "period must be 'AM' or 'PM'" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch BCC settings
    const bccList = await getBccList();

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch all participants for this training
    const { data: participants, error: participantsError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", trainingId);

    if (participantsError) {
      throw new Error("Failed to fetch participants");
    }

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No participants to send to" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Fetch schedule for this date to get times
    const { data: schedule } = await supabase
      .from("training_schedules")
      .select("start_time, end_time")
      .eq("training_id", trainingId)
      .eq("day_date", scheduleDate)
      .maybeSingle();

    // Get signature and sender from
    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();

    // Format date
    const dateObj = new Date(scheduleDate);
    const formattedDate = dateObj.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Determine time range
    let timeRange: string;
    if (schedule) {
      const startTime = schedule.start_time.slice(0, 5).replace(":", "h");
      const endTime = schedule.end_time.slice(0, 5).replace(":", "h");
      timeRange = period === "AM" ? `${startTime} - 12h30` : `14h00 - ${endTime}`;
    } else {
      timeRange = period === "AM" ? "9h00 - 12h30" : "14h00 - 17h30";
    }

    const periodLabel = period === "AM" ? "Matin" : "Après-midi";
    const baseUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];

      // Rate-limit: 300ms delay between emails (except before the first)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      try {
        // Check if signature record already exists
        const { data: existingSignature } = await supabase
          .from("attendance_signatures")
          .select("*")
          .eq("training_id", trainingId)
          .eq("participant_id", participant.id)
          .eq("schedule_date", scheduleDate)
          .eq("period", period)
          .maybeSingle();

        let token: string;

        if (existingSignature) {
          // If already signed, skip
          if (existingSignature.signed_at) {
            console.log(`Skipping ${participant.email} - already signed`);
            continue;
          }
          token = existingSignature.token;
        } else {
          // Create new signature record (without email_sent_at yet)
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
            console.error("Error creating signature record:", insertError);
            errorCount++;
            continue;
          }
        }

        // Build email
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

        // Send email
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
          console.error(`Resend error for ${participant.email}:`, errorText);
          errorCount++;
          continue;
        }

        console.log(`Signature request email sent to: ${participant.email}`);
        successCount++;

        // Update email_sent_at AFTER successful send
        await supabase
          .from("attendance_signatures")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("training_id", trainingId)
          .eq("participant_id", participant.id)
          .eq("schedule_date", scheduleDate)
          .eq("period", period);

        // Log activity
        const emailSubject = `✍️ Émargement – ${training.training_name} – ${formattedDate} ${periodLabel}`;
        const emailContentText = `${greeting}\n\nMerci de bien vouloir signer ta présence pour la formation "${training.training_name}".\n\n📍 Lieu : ${training.location}\n📅 Date : ${formattedDate}\n🕐 Horaire : ${periodLabel} (${timeRange})\n\nCette signature électronique a valeur légale conformément au règlement européen eIDAS.`;
        
        try {
          await supabase.from("activity_logs").insert({
            action_type: "attendance_signature_request_sent",
            recipient_email: participant.email,
            details: {
              training_id: trainingId,
              training_name: training.training_name,
              schedule_date: scheduleDate,
              period,
              participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
              email_subject: emailSubject,
              email_content: emailContentText,
            },
          });
        } catch (logError) {
          console.warn("Failed to log activity:", logError);
        }
      } catch (err) {
        console.error(`Error processing participant ${participant.email}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        errors: errorCount,
        total: participants.length,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-attendance-signature-request:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
