import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom, getSenderEmail, getSenderName, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { formatDateFr, formatDateWithDayFr } from "../_shared/date-utils.ts";

/**
 * Process Participant List Reminders
 *
 * Runs daily. For each training starting within 30 days that has 0 participants,
 * sends an alert email to the trainer every 2 working days.
 * Stops when participants are added or training starts.
 */


function getWorkingDaysBetween(
  from: Date,
  to: Date,
  workingDays: boolean[]
): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const target = new Date(to);
  target.setHours(0, 0, 0, 0);

  while (current < target) {
    current.setDate(current.getDate() + 1);
    if (workingDays[current.getDay()]) {
      count++;
    }
  }
  return count;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Calculate date 30 days from now
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const maxDate = thirtyDaysFromNow.toISOString().split("T")[0];

    console.log(`[participant-list-reminders] Checking trainings between ${today} and ${maxDate}`);

    // Get trainings starting within 30 days (excluding today and past)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("id, training_name, client_name, start_date, location, trainer_id")
      .gte("start_date", tomorrowStr)
      .lte("start_date", maxDate);

    if (trainingsError) throw trainingsError;

    if (!trainings || trainings.length === 0) {
      console.log("[participant-list-reminders] No upcoming trainings within 30 days");
      return new Response(
        JSON.stringify({ success: true, message: "No trainings to check" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch working days config
    const defaultWorkingDays = [false, true, true, true, true, true, false];
    let workingDays = defaultWorkingDays;
    try {
      const { data: wdData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "working_days")
        .single();
      if (wdData?.setting_value) {
        const parsed = JSON.parse(wdData.setting_value);
        if (Array.isArray(parsed) && parsed.length === 7) workingDays = parsed;
      }
    } catch (e) { console.error("Failed to parse working days config, using default:", e); }

    // Check if today is a working day
    if (!workingDays[now.getDay()]) {
      console.log("[participant-list-reminders] Today is not a working day, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Not a working day" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results: { trainingId: string; trainingName: string; sent: boolean; reason: string }[] = [];

    // Fetch Signitic signature and sender info
    const [signature, defaultEmail, senderFrom] = await Promise.all([
      getSigniticSignature(),
      getSenderEmail(),
      getSenderFrom(),
    ]);

    for (const training of trainings) {
      // Count participants
      const { count } = await supabase
        .from("training_participants")
        .select("id", { count: "exact", head: true })
        .eq("training_id", training.id);

      if (count && count > 0) {
        results.push({
          trainingId: training.id,
          trainingName: training.training_name,
          sent: false,
          reason: `Has ${count} participant(s)`,
        });
        continue;
      }

      // Check last reminder sent for this training
      const { data: lastReminder } = await supabase
        .from("scheduled_emails")
        .select("sent_at, scheduled_for")
        .eq("training_id", training.id)
        .eq("email_type", "participant_list_reminder")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1);

      if (lastReminder && lastReminder.length > 0) {
        const lastSentDate = new Date(lastReminder[0].sent_at);
        const workingDaysSinceLast = getWorkingDaysBetween(lastSentDate, now, workingDays);

        if (workingDaysSinceLast < 2) {
          results.push({
            trainingId: training.id,
            trainingName: training.training_name,
            sent: false,
            reason: `Only ${workingDaysSinceLast} working day(s) since last reminder`,
          });
          continue;
        }
      }

      // Get trainer info
      let trainerEmail = defaultEmail;
      let trainerFirstName = await getSenderName();
      if (training.trainer_id) {
        const { data: trainer } = await supabase
          .from("trainers")
          .select("email, first_name")
          .eq("id", training.trainer_id)
          .single();
        if (trainer) {
          trainerEmail = trainer.email || trainerEmail;
          trainerFirstName = trainer.first_name || trainerFirstName;
        }
      }

      // Calculate days remaining
      const startDate = new Date(training.start_date + "T00:00:00");
      const daysRemaining = Math.ceil(
        (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Build email
      const subject = `⚠️ Alerte : aucun participant pour « ${training.training_name} » (J-${daysRemaining})`;

      const bodyHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <p>Bonjour ${trainerFirstName},</p>

  <p>Petit rappel amical 😊 — la formation <strong>« ${training.training_name} »</strong> pour <strong>${training.client_name}</strong> démarre le <strong>${formatDateWithDayFr(startDate)}</strong> (dans ${daysRemaining} jours) et <strong>aucun participant n'est encore inscrit</strong>.</p>

  <p>Il serait bon de :</p>
  <ul>
    <li>🔍 Relancer le client pour obtenir la liste des participants</li>
    <li>📋 Vérifier si la formation est toujours maintenue</li>
    <li>❌ Envisager une annulation si aucun retour ne vient</li>
  </ul>

  <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
    <tr style="background: #f8f9fa;">
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-weight: bold;">Formation</td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${training.training_name}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-weight: bold;">Client</td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${training.client_name}</td>
    </tr>
    <tr style="background: #f8f9fa;">
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-weight: bold;">Date de début</td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${formatDateWithDayFr(startDate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-weight: bold;">Lieu</td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${training.location || "Non défini"}</td>
    </tr>
    <tr style="background: #fff3cd;">
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-weight: bold;">Participants inscrits</td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold;">0</td>
    </tr>
  </table>

  <p>Ce message est envoyé automatiquement tous les 2 jours ouvrés tant qu'aucun participant n'est ajouté.</p>

  <p>Bonne journée ! 🚀</p>

  ${signature}
</body>
</html>`;

      // Send email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("[participant-list-reminders] RESEND_API_KEY not configured");
        results.push({
          trainingId: training.id,
          trainingName: training.training_name,
          sent: false,
          reason: "RESEND_API_KEY not configured",
        });
        continue;
      }

      // BCC settings
      const bccAddresses = await getBccList();

      const emailPayload: Record<string, unknown> = {
        from: senderFrom,
        to: [trainerEmail],
        bcc: bccAddresses,
        subject,
        html: bodyHtml,
      };

      const resendResult = await sendEmail({
        from: senderFrom,
        to: [trainerEmail],
        bcc: bccAddresses,
        subject,
        html: bodyHtml,
        _emailType: "participant_list_reminder",
        _trainingId: training.id,
      });

      if (!resendResult.success) {
        console.error(`[participant-list-reminders] sendEmail error for ${training.id}:`, resendResult.error);
        results.push({
          trainingId: training.id,
          trainingName: training.training_name,
          sent: false,
          reason: `sendEmail error: ${resendResult.error}`,
        });
        continue;
      }

      // Log in scheduled_emails as sent
      await supabase.from("scheduled_emails").insert({
        training_id: training.id,
        email_type: "participant_list_reminder",
        scheduled_for: now.toISOString(),
        sent_at: now.toISOString(),
        status: "sent",
      });

      console.log(`[participant-list-reminders] Alert sent for "${training.training_name}" to ${trainerEmail}`);
      results.push({
        trainingId: training.id,
        trainingName: training.training_name,
        sent: true,
        reason: `Sent to ${trainerEmail}`,
      });

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const sentCount = results.filter((r) => r.sent).length;
    console.log(`[participant-list-reminders] Done: ${sentCount} alerts sent out of ${trainings.length} trainings checked`);

    return new Response(
      JSON.stringify({ success: true, checked: trainings.length, sent: sentCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("[participant-list-reminders] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
