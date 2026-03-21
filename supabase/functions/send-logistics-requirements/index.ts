import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate, textToHtml } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * Send Logistics Requirements Email
 *
 * Sends an email to the training sponsor (commanditaire) listing
 * logistics requirements (room, equipment, catering, contact info).
 *
 * Trigger rules:
 * - Automatically sent 60 days before training start_date
 * - If training is created < 60 days before, send immediately
 * - If sponsor changes after email was sent, re-send to new sponsor
 *
 * Can be called:
 * - By cron (no body → processes all eligible trainings)
 * - Manually with { trainingId } to force send for a specific training
 */

const VERSION = "send-logistics-requirements@1.0.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body = cron mode
    }

    const forcedTrainingId = body?.trainingId;
    const results: any[] = [];

    // ── Fetch eligible trainings ──
    let query = supabase
      .from("trainings")
      .select("id, training_name, start_date, sponsor_email, sponsor_first_name, sponsor_formal_address, location, format_formation, logistics_email_sent_at, logistics_email_sent_to, is_cancelled")
      .not("sponsor_email", "is", null)
      .not("start_date", "is", null)
      .or("is_cancelled.is.null,is_cancelled.eq.false");

    if (forcedTrainingId) {
      query = query.eq("id", forcedTrainingId);
    } else {
      // Cron mode: only future trainings
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("start_date", today);
    }

    const { data: trainings, error: trainingsError } = await query;
    if (trainingsError) throw trainingsError;

    if (!trainings || trainings.length === 0) {
      console.log(`[${VERSION}] No eligible trainings found`);
      return new Response(
        JSON.stringify({ success: true, message: "No eligible trainings", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pre-fetch shared resources
    const [bccList, signature, senderFrom, senderEmail] = await Promise.all([
      getBccList(),
      getSigniticSignature(),
      getSenderFrom(),
      getSenderEmail(),
    ]);

    for (const training of trainings) {
      try {
        // Skip non-presentiel formats (no room needed)
        if (training.format_formation === "e_learning" || training.format_formation === "classe_virtuelle") {
          continue;
        }

        if (!training.sponsor_email) continue;

        const startDate = new Date(training.start_date);
        startDate.setHours(0, 0, 0, 0);
        const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Determine if we should send
        let shouldSend = false;
        let reason = "";

        if (!training.logistics_email_sent_at) {
          // Never sent: send if within 60 days or if forced
          if (daysUntilStart <= 60 || forcedTrainingId) {
            shouldSend = true;
            reason = daysUntilStart <= 60 ? `${daysUntilStart} days until start` : "forced";
          }
        } else if (training.logistics_email_sent_to !== training.sponsor_email) {
          // Sponsor changed: re-send
          shouldSend = true;
          reason = `sponsor changed from ${training.logistics_email_sent_to} to ${training.sponsor_email}`;
        }

        if (!shouldSend) continue;

        console.log(`[${VERSION}] Sending for "${training.training_name}" — ${reason}`);

        // Format training date for email
        const trainingDateFormatted = new Date(training.start_date).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        // Fetch template
        const useTutoiement = training.sponsor_formal_address === false;
        const templateType = useTutoiement ? "logistics_requirements_tu" : "logistics_requirements_vous";

        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, html_content")
          .eq("template_type", templateType)
          .maybeSingle();

        if (!template) {
          console.warn(`[${VERSION}] No template found for ${templateType}`);
          continue;
        }

        // Process template
        const variables = {
          sponsor_first_name: training.sponsor_first_name || null,
          training_name: training.training_name,
          training_date: trainingDateFormatted,
          location: training.location || "",
        };

        const emailSubject = processTemplate(template.subject, variables, false);
        const contentText = processTemplate(template.html_content, variables, false);
        const contentHtml = textToHtml(contentText);
        const htmlContent = `${contentHtml}\n${signature}`;

        // Send email
        const result = await sendEmail({
          from: senderFrom,
          to: [training.sponsor_email],
          bcc: bccList,
          subject: emailSubject,
          html: htmlContent,
          replyTo: senderEmail,
          _emailType: "logistics_requirements",
          _trainingId: training.id,
        });

        if (!result.success) {
          console.error(`[${VERSION}] Failed to send for ${training.id}: ${result.error}`);
          results.push({ trainingId: training.id, success: false, error: result.error });
          continue;
        }

        // Update tracking
        await supabase
          .from("trainings")
          .update({
            logistics_email_sent_at: new Date().toISOString(),
            logistics_email_sent_to: training.sponsor_email,
          })
          .eq("id", training.id);

        // Log activity
        await supabase.from("activity_logs").insert({
          action_type: "logistics_requirements_sent",
          recipient_email: training.sponsor_email,
          details: {
            training_id: training.id,
            training_name: training.training_name,
            sponsor_email: training.sponsor_email,
            reason,
          },
        });

        console.log(`[${VERSION}] ✅ Sent to ${training.sponsor_email} for "${training.training_name}"`);
        results.push({ trainingId: training.id, success: true, email: training.sponsor_email });

        // Rate limit: 400ms between emails
        await new Promise((r) => setTimeout(r, 400));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[${VERSION}] Error for training ${training.id}: ${msg}`);
        results.push({ trainingId: training.id, success: false, error: msg });
      }
    }

    console.log(`[${VERSION}] Done. Processed ${results.length} training(s)`);

    return new Response(
      JSON.stringify({ success: true, results, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${VERSION}] Fatal error: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
