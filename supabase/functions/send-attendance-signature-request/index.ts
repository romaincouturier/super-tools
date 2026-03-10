import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate, textToHtml } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default templates
const DEFAULT_SUBJECT_TU = "Signature d'émargement - {{training_name}}";
const DEFAULT_SUBJECT_VOUS = "Signature d'émargement - {{training_name}}";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer ta feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de ta présence à la formation.

Merci !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de votre présence à la formation.

Merci !`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trainingId, scheduleDate, period } = await req.json();

    if (!trainingId || !scheduleDate || !period) {
      return new Response(
        JSON.stringify({ error: "trainingId, scheduleDate, and period are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["AM", "PM"].includes(period)) {
      return new Response(
        JSON.stringify({ error: "period must be 'AM' or 'PM'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Determine tu/vous
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = `attendance_signature${templateTypeSuffix}`;

    // Fetch template, participants, BCC, signature, and schedule in parallel
    const [templateResult, participantsResult, bccList, signature, senderFrom, scheduleResult] = await Promise.all([
      supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", templateType)
        .maybeSingle(),
      supabase
        .from("training_participants")
        .select("*")
        .eq("training_id", trainingId),
      getBccList(),
      getSigniticSignature(),
      getSenderFrom(),
      supabase
        .from("training_schedules")
        .select("start_time, end_time")
        .eq("training_id", trainingId)
        .eq("day_date", scheduleDate)
        .maybeSingle(),
    ]);

    const customTemplate = templateResult.data;
    const participants = participantsResult.data;
    const schedule = scheduleResult.data;

    if (participantsResult.error) {
      throw new Error("Failed to fetch participants");
    }

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No participants to send to" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

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
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const baseUrl = urls.app_url;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];

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
          if (existingSignature.signed_at) {
            console.log(`Skipping ${participant.email} - already signed`);
            continue;
          }
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
            console.error("Error creating signature record:", insertError);
            errorCount++;
            continue;
          }
        }

        // Build email from template
        const signatureUrl = `${baseUrl}/emargement/${token}`;

        const variables = {
          first_name: participant.first_name || null,
          training_name: training.training_name,
          session_date: `${formattedDate} - ${periodLabel} (${timeRange})`,
          signature_link: signatureUrl,
          training_location: training.location || "",
        };

        const emailSubject = processTemplate(subjectTemplate, variables, false);
        const contentText = processTemplate(contentTemplate, variables, false);
        const contentHtml = textToHtml(contentText);
        const htmlContent = `${contentHtml}\n${signature}`;

        // Send email
        const result = await sendEmail({
          from: senderFrom,
          to: [participant.email],
          bcc: bccList,
          subject: emailSubject,
          html: htmlContent,
          _emailType: "attendance_signature_request",
          _trainingId: trainingId,
          _participantId: participant.id,
        });

        if (!result.success) {
          console.error(`sendEmail error for ${participant.email}:`, result.error);
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
              email_content: contentText,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-attendance-signature-request:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
