import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";

/**
 * Process Live Reminders
 *
 * Runs daily at 07:00 via cron job.
 * For each live meeting (training_live_meetings) scheduled today:
 *  - Sends a reminder email to all participants of the training
 *  - Uses tu/vous templates based on training setting
 *  - Includes meeting URL and custom email content if set
 *
 * Uses activity_logs to prevent duplicate sends.
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

    const now = new Date();
    // Use Europe/Paris timezone for "today"
    const parisDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // "YYYY-MM-DD"
    console.log(`[process-live-reminders] Checking lives scheduled on ${parisDate}`);

    // Fetch all live meetings scheduled today that are not cancelled
    const { data: liveMeetings, error: livesError } = await supabase
      .from("training_live_meetings")
      .select(`
        id,
        title,
        scheduled_at,
        meeting_url,
        email_content,
        status,
        training_id,
        trainings!inner (
          id,
          training_name,
          participants_formal_address,
          trainer_id,
          supports_url
        )
      `)
      .gte("scheduled_at", parisDate + "T00:00:00+00:00")
      .lte("scheduled_at", parisDate + "T23:59:59+00:00")
      .neq("status", "cancelled");

    if (livesError) {
      console.error("[process-live-reminders] Error fetching lives:", livesError);
      throw livesError;
    }

    if (!liveMeetings || liveMeetings.length === 0) {
      console.log("[process-live-reminders] No live meetings today");
      return new Response(
        JSON.stringify({ success: true, message: "No live meetings today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-live-reminders] Found ${liveMeetings.length} live(s) today`);

    // Fetch templates (participant + trainer)
    const { data: templates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content")
      .in("template_type", ["live_reminder_tu", "live_reminder_vous", "trainer_live_reminder"]);

    const templateMap: Record<string, { subject: string; html_content: string }> = {};
    for (const t of templates || []) {
      templateMap[t.template_type] = { subject: t.subject, html_content: t.html_content };
    }

    // Build trainer lookup
    const trainerIds = [...new Set(liveMeetings.map((l: any) => (l.trainings as any)?.trainer_id).filter(Boolean))];
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

    let totalSent = 0;

    for (const live of liveMeetings) {
      const training = live.trainings as any;
      const trainingId = live.training_id;
      const liveId = live.id;

      // Fetch participants
      const { data: participants } = await supabase
        .from("training_participants")
        .select("id, first_name, email")
        .eq("training_id", trainingId);

      if (!participants || participants.length === 0) {
        console.log(`[process-live-reminders] No participants for training ${trainingId}`);
        continue;
      }

      // Retry-safe dedup per participant for this live (prevents duplicates on reruns)
      const participantLogKeys = participants
        .filter((p: any) => !!p.id)
        .map((p: any) => `${liveId}:${p.id}`);

      const { data: existingParticipantLogs } = participantLogKeys.length > 0
        ? await supabase
            .from("activity_logs")
            .select("recipient_email")
            .eq("action_type", "live_reminder_participant_sent")
            .in("recipient_email", participantLogKeys)
        : { data: [] as { recipient_email: string }[] };

      const alreadySentKeys = new Set(
        (existingParticipantLogs || []).map((row: any) => row.recipient_email)
      );

      const useFormal = !!training.participants_formal_address;
      const templateKey = useFormal ? "live_reminder_vous" : "live_reminder_tu";
      const template = templateMap[templateKey];

      // Format live date/time in Paris timezone
      const liveDateTime = new Date(live.scheduled_at);
      const liveDate = liveDateTime.toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const liveTime = liveDateTime.toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      });

      const liveMeetingUrl = live.meeting_url || "";
      const liveEmailContent = live.email_content || "";
      const liveTitle = live.title || "Live collectif";
      const supportsUrl = training.supports_url || "";

      let sentCount = 0;
      let skippedAlreadySent = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        if (!p.email) continue;

        const participantLogKey = `${liveId}:${p.id}`;
        if (alreadySentKeys.has(participantLogKey)) {
          skippedAlreadySent++;
          continue;
        }

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        const firstName = p.first_name || "";
        const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

        let subject: string;
        let htmlContent: string;

        // If custom email content was set on the live meeting, use it directly
        if (liveEmailContent) {
          const customBody = liveEmailContent.replace(/\n/g, "<br>");
          const meetingUrlSection = liveMeetingUrl
            ? `<p><a href="${liveMeetingUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>`
            : "";
          subject = `📺 Rappel : Live "${liveTitle}" aujourd'hui – ${training.training_name}`;
          htmlContent = `
            <p>${greeting}</p>
            ${customBody}
            ${meetingUrlSection}
            ${signatureHtml}
          `;
        } else if (template) {
          // Use template
          const variables: Record<string, string | null | undefined> = {
            first_name: firstName,
            training_name: training.training_name,
            live_title: liveTitle,
            live_date: liveDate,
            live_time: liveTime,
            meeting_url: liveMeetingUrl || undefined,
            supports_url: supportsUrl || undefined,
          };

          subject = processTemplate(template.subject, variables, false);
          const body = processTemplate(template.html_content, variables, false);
          htmlContent = body
            .split(/\n\n+/)
            .filter((paragraph: string) => paragraph.trim() !== "")
            .map((paragraph: string) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
            .join("") + "\n" + signatureHtml;
        } else {
          // Fallback
          const meetingUrlSection = liveMeetingUrl
            ? `<p><a href="${liveMeetingUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>`
            : "";
          const supportsSection = supportsUrl
            ? `<p>📚 Pour rappel, ${useFormal ? "vous pouvez retrouver" : "tu peux retrouver"} les supports de la formation ici : <a href="${supportsUrl}" style="color: #e6bc00; font-weight: bold;">Accéder aux supports</a></p>`
            : "";
          subject = `📺 Rappel : Live "${liveTitle}" aujourd'hui – ${training.training_name}`;
          htmlContent = `
            <p>${greeting}</p>
            <p>Pour rappel, ${useFormal ? "vous avez" : "tu as"} un live collectif prévu aujourd'hui dans le cadre de la formation <strong>"${training.training_name}"</strong> :</p>
            <ul>
              <li><strong>${liveTitle}</strong></li>
              <li>📅 ${liveDate} à ${liveTime}</li>
            </ul>
            ${meetingUrlSection}
            ${supportsSection}
            <p>${useFormal ? "Votre" : "Ta"} présence est importante pour profiter pleinement de ce moment d'échange.</p>
            <p>À tout à l'heure !</p>
            ${signatureHtml}
          `;
        }

        const result = await sendEmail({
          to: p.email,
          bcc: bccList,
          subject,
          html: htmlContent,
          _trainingId: trainingId,
          _participantId: p.id,
          _emailType: "live_reminder",
        });

        if (result.success) {
          sentCount++;
          alreadySentKeys.add(participantLogKey);
          console.log(`[process-live-reminders] Sent to ${p.email}`);

          try {
            await supabase.from("activity_logs").insert({
              action_type: "live_reminder_participant_sent",
              recipient_email: participantLogKey,
              details: {
                training_id: trainingId,
                training_name: training.training_name,
                live_title: liveTitle,
                participant_id: p.id,
                participant_email: p.email,
              },
            });
          } catch (logErr) {
            console.warn("[process-live-reminders] Failed to log participant send:", logErr);
          }
        }
      }

      totalSent += sentCount;

      // ── Trainer reminder for this live ─────────────────────────────
      const trainerTemplate = templateMap["trainer_live_reminder"];
      const trainer = training.trainer_id ? trainerMap[training.trainer_id] : null;

      if (trainerTemplate && trainer?.email) {
        const trainerLogKey = `${trainer.email}:${liveId}`;
        const { data: trainerLog } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("action_type", "trainer_live_reminder_sent")
          .eq("recipient_email", trainerLogKey)
          .limit(1);

        if (!trainerLog || trainerLog.length === 0) {
          // Check if attendance signatures exist for this training
          const { count: attendanceCount } = await supabase
            .from("attendance_signatures")
            .select("id", { count: "exact", head: true })
            .eq("training_id", trainingId);

          const hasAttendance = (attendanceCount || 0) > 0;

          const trainerVars: Record<string, string | null | undefined> = {
            trainer_first_name: trainer.first_name || "",
            training_name: training.training_name,
            live_title: liveTitle,
            live_date: liveDate,
            live_time: liveTime,
            meeting_url: liveMeetingUrl || undefined,
            has_attendance: hasAttendance ? "1" : undefined,
          };

          const trainerSubject = processTemplate(trainerTemplate.subject, trainerVars, false);
          const trainerBody = processTemplate(trainerTemplate.html_content, trainerVars, false);
          const trainerHtml = trainerBody
            .split(/\n\n+/)
            .filter((p: string) => p.trim() !== "")
            .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("") + "\n" + signatureHtml;

          await new Promise(resolve => setTimeout(resolve, 400));

          const trainerResult = await sendEmail({
            to: trainer.email,
            bcc: bccList,
            subject: trainerSubject,
            html: trainerHtml,
            _trainingId: trainingId,
            _emailType: "trainer_live_reminder",
          });

          if (trainerResult.success) {
            totalSent++;
            console.log(`[process-live-reminders] Trainer reminder sent to ${trainer.email}`);

            try {
              await supabase.from("activity_logs").insert({
                action_type: "trainer_live_reminder_sent",
                recipient_email: trainerLogKey,
                details: {
                  training_id: trainingId,
                  training_name: training.training_name,
                  live_title: liveTitle,
                },
              });
            } catch (logErr) {
              console.warn("[process-live-reminders] Failed to log trainer reminder:", logErr);
            }
          } else {
            console.warn(`[process-live-reminders] Trainer reminder failed for ${trainer.email}`);
          }
        }
      }

      // Summary log of this run (informational, not used for hard dedup)
      try {
        await supabase.from("activity_logs").insert({
          action_type: "live_reminder_sent",
          recipient_email: liveId,
          details: {
            training_id: trainingId,
            training_name: training.training_name,
            live_title: liveTitle,
            participants_total: participants.length,
            participants_sent_this_run: sentCount,
            participants_already_sent: skippedAlreadySent,
          },
        });
      } catch (logErr) {
        console.warn("[process-live-reminders] Failed to log summary:", logErr);
      }
    }

    console.log(`[process-live-reminders] Done. Sent ${totalSent} reminder(s).`);

    return new Response(
      JSON.stringify({
        success: true,
        lives_processed: liveMeetings.length,
        emails_sent: totalSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[process-live-reminders] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
