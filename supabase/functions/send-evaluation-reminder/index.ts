import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature for romain@supertilt.fr
async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");
  
  if (!signiticApiKey) {
    console.warn("SIGNITIC_API_KEY not configured, using default signature");
    return getDefaultSignature();
  }

  try {
    const response = await fetch(
      "https://api.signitic.app/signatures/romain@supertilt.fr/html",
      {
        headers: {
          "x-api-key": signiticApiKey,
        },
      }
    );

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && !htmlContent.includes("error")) {
        console.log("Signitic signature fetched successfully");
        return htmlContent;
      }
    }
    
    console.warn("Could not fetch Signitic signature:", response.status);
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}

function getDefaultSignature(): string {
  return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
    <strong>Romain Couturier</strong><br/>
    Supertilt - Formation professionnelle<br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
}

// Default templates - Reminder 1
const DEFAULT_SUBJECT_REMINDER_1_TU = "📝 Petit rappel : ton avis compte pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_1_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour ta contribution !

Belle journée à toi`;

const DEFAULT_SUBJECT_REMINDER_1_VOUS = "📝 Petit rappel : votre avis compte pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_1_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour votre contribution !

Belle journée à vous`;

// Default templates - Reminder 2
const DEFAULT_SUBJECT_REMINDER_2_TU = "🙏 Dernière relance : ta contribution pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_2_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers toi une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !

Si tu as 2 minutes, voici le lien :
{{evaluation_link}}

Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !

À bientôt`;

const DEFAULT_SUBJECT_REMINDER_2_VOUS = "🙏 Dernière relance : votre contribution pour \"{{training_name}}\"";
const DEFAULT_CONTENT_REMINDER_2_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers vous une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !

Si vous avez 2 minutes, voici le lien :
{{evaluation_link}}

Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !

À bientôt`;

// Process template with variables
function processTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template;

  // Process conditional blocks: {{#var}}content{{/var}}
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(conditionalRegex, (match, varName, content) => {
    const value = variables[varName];
    return value ? content : "";
  });

  // Process simple variables: {{var}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (match, varName) => {
    const value = variables[varName];
    return value || "";
  });

  return result;
}

// Convert plain text to HTML
function textToHtml(text: string): string {
  return text
    .split("\n")
    .map(line => line.trim() === "" ? "<br/>" : `<p>${line}</p>`)
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scheduledEmailId } = await req.json();

    if (!scheduledEmailId) {
      return new Response(
        JSON.stringify({ error: "scheduledEmailId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the scheduled email
    const { data: scheduledEmail, error: scheduledError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("id", scheduledEmailId)
      .single();

    if (scheduledError || !scheduledEmail) {
      throw new Error("Scheduled email not found");
    }

    if (scheduledEmail.status !== "pending") {
      return new Response(
        JSON.stringify({ success: true, message: "Email already processed", status: scheduledEmail.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isReminder1 = scheduledEmail.email_type === "evaluation_reminder_1";
    const isReminder2 = scheduledEmail.email_type === "evaluation_reminder_2";

    if (!isReminder1 && !isReminder2) {
      return new Response(
        JSON.stringify({ error: "This function only handles evaluation reminders" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trainingId = scheduledEmail.training_id;
    const participantId = scheduledEmail.participant_id;

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    // Check if the participant has already submitted their evaluation
    const { data: evaluation, error: evalError } = await supabase
      .from("training_evaluations")
      .select("id, etat, token")
      .eq("training_id", trainingId)
      .eq("participant_id", participantId)
      .single();

    // If evaluation exists and is submitted, cancel this reminder
    if (evaluation && evaluation.etat === "soumis") {
      console.log(`Participant ${participant.email} has already submitted evaluation, cancelling reminder`);
      
      // Mark as cancelled
      await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", error_message: "Évaluation déjà soumise" })
        .eq("id", scheduledEmailId);

      return new Response(
        JSON.stringify({ success: true, message: "Reminder cancelled - evaluation already submitted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no evaluation record exists, we can't send a reminder (no token)
    if (!evaluation) {
      console.log(`No evaluation record for participant ${participant.email}, cancelling reminder`);
      
      await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", error_message: "Aucune évaluation créée pour ce participant" })
        .eq("id", scheduledEmailId);

      return new Response(
        JSON.stringify({ success: true, message: "Reminder cancelled - no evaluation record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if we should use tutoiement or vouvoiement
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = isReminder1 ? "evaluation_reminder_1" : "evaluation_reminder_2";
    
    // Fetch custom email template if exists
    const { data: customTemplate } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `${templateType}${templateTypeSuffix}`)
      .single();

    // Use appropriate default based on reminder type and formality setting
    let defaultSubject: string;
    let defaultContent: string;

    if (isReminder1) {
      defaultSubject = useTutoiement ? DEFAULT_SUBJECT_REMINDER_1_TU : DEFAULT_SUBJECT_REMINDER_1_VOUS;
      defaultContent = useTutoiement ? DEFAULT_CONTENT_REMINDER_1_TU : DEFAULT_CONTENT_REMINDER_1_VOUS;
    } else {
      defaultSubject = useTutoiement ? DEFAULT_SUBJECT_REMINDER_2_TU : DEFAULT_SUBJECT_REMINDER_2_VOUS;
      defaultContent = useTutoiement ? DEFAULT_CONTENT_REMINDER_2_TU : DEFAULT_CONTENT_REMINDER_2_VOUS;
    }

    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Get Signitic signature
    const signature = await getSigniticSignature();

    // Fetch BCC settings
    const { data: bccSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcc_email", "bcc_enabled"]);
    
    let bccEnabled = true;
    let bccEmailValue: string | null = null;
    
    bccSettings?.forEach((s: { setting_key: string; setting_value: string | null }) => {
      if (s.setting_key === "bcc_enabled") {
        bccEnabled = s.setting_value === "true";
      }
      if (s.setting_key === "bcc_email" && s.setting_value) {
        bccEmailValue = s.setting_value;
      }
    });
    
    const bccEmail = bccEnabled && bccEmailValue ? bccEmailValue : null;

    // Build evaluation link
    const baseUrl = "https://super-tools.lovable.app";
    const evaluationLink = `${baseUrl}/evaluation/${evaluation.token}`;
    
    // Process templates with variables
    const variables = {
      first_name: participant.first_name,
      training_name: training.training_name,
      evaluation_link: evaluationLink,
    };

    const subject = processTemplate(subjectTemplate, variables);
    const contentText = processTemplate(contentTemplate, variables);
    const contentHtml = textToHtml(contentText);

    const htmlContent = `
      ${contentHtml}
      ${signature}
    `;

    console.log(`Sending ${templateType} to:`, participant.email);

    // Build BCC list
    const bccList: string[] = [];
    if (bccEmail) {
      bccList.push(bccEmail);
    }
    bccList.push("supertilt@bcc.nocrm.io");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [participant.email],
        bcc: bccList,
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      
      // Mark as failed
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error_message: errorText })
        .eq("id", scheduledEmailId);

      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    // Mark as sent
    await supabase
      .from("scheduled_emails")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", scheduledEmailId);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: `${templateType}_sent`,
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
          email_subject: subject,
          email_content: contentText,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    console.log(`${templateType} sent successfully to ${participant.email}`);

    return new Response(
      JSON.stringify({ success: true, email: participant.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending evaluation reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send evaluation reminder";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
