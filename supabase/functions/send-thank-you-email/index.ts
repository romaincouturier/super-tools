import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomBytes, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Generate a secure token for evaluation access
function generateEvaluationToken(): string {
  const uuid = crypto.randomUUID();
  const randomPart = randomBytes(8).toString("hex");
  const hash = createHash("sha256").update(uuid + randomPart).digest("hex").slice(0, 16);
  return `${uuid}-${hash}`;
}

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

// Default template content - Tutoiement version
const DEFAULT_SUBJECT_TU = "Merci pour ta participation à la formation {{training_name}}";
const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ton énergie et ta participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que tu prennes quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Tu trouveras également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans tes présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment tu vas utiliser tout ce que nous avons vu ! N'hésite pas à me contacter si tu as des questions ou des besoins de compléments d'informations.

Je te souhaite une bonne journée`;

// Default template content - Vouvoiement version
const DEFAULT_SUBJECT_VOUS = "Merci pour votre participation à la formation {{training_name}}";
const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée`;

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
    const { trainingId, testEmail } = await req.json();

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "trainingId is required" }),
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

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Determine if we should use tutoiement or vouvoiement
    const useTutoiement = training.participants_formal_address === false;
    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    
    // Fetch custom email template if exists (with mode suffix)
    const { data: customTemplate } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `thank_you${templateTypeSuffix}`)
      .single();

    // Use appropriate default based on formality setting
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;

    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Fetch BCC settings
    const { data: bccSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcc_email", "bcc_enabled"]);
    
    // Default: BCC enabled with the email if bcc_email exists
    let bccEnabled = true; // Default to true for backward compatibility
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
    
    console.log("BCC settings - enabled:", bccEnabled, "email:", bccEmailValue, "final:", bccEmail || "none");

    // Get Signitic signature
    const signature = await getSigniticSignature();

    const trainingName = training.training_name;
    const supportsUrl = training.supports_url || "";
    
    // Base URL for evaluation links
    const baseUrl = "https://super-tools.lovable.app";

    // TEST MODE: Send only to the test email
    if (testEmail) {
      console.log("Sending TEST email to:", testEmail);
      
      const variables = {
        first_name: "Test",
        training_name: trainingName,
        evaluation_link: `${baseUrl}/evaluation/test-token-preview`,
        supports_url: supportsUrl,
      };

      const subject = `[TEST] ${processTemplate(subjectTemplate, variables)}`;
      const contentText = processTemplate(contentTemplate, variables);
      const contentHtml = textToHtml(contentText);

      const htmlContent = `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-bottom: 20px; border-radius: 4px;">
          <strong>⚠️ Ceci est un email de test</strong><br/>
          Le lien d'évaluation ci-dessous est un exemple et ne fonctionne pas.
        </div>
        ${contentHtml}
        ${signature}
      `;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Romain Couturier <romain@supertilt.fr>",
          to: [testEmail],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Resend error:", errorText);
        throw new Error(`Failed to send test email: ${emailResponse.status}`);
      }

      return new Response(
        JSON.stringify({ success: true, testEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PRODUCTION MODE: Send to all participants
    // Fetch participants
    const { data: participants, error: participantsError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", trainingId);

    if (participantsError || !participants || participants.length === 0) {
      throw new Error("No participants found for this training");
    }

    // Create evaluations and send individual emails to each participant sequentially
    const results: { email: string; success: boolean }[] = [];
    
    for (const participant of participants) {
      // Check if evaluation already exists
      const { data: existingEval } = await supabase
        .from("training_evaluations")
        .select("id, token")
        .eq("participant_id", participant.id)
        .eq("training_id", trainingId)
        .single();

      let evaluationToken: string;

      if (existingEval) {
        evaluationToken = existingEval.token;
      } else {
        // Create a new evaluation record
        evaluationToken = generateEvaluationToken();
        
        const { error: evalError } = await supabase
          .from("training_evaluations")
          .insert({
            training_id: trainingId,
            participant_id: participant.id,
            token: evaluationToken,
            email: participant.email,
            first_name: participant.first_name,
            last_name: participant.last_name,
            company: participant.company,
            etat: "envoye",
            date_envoi: new Date().toISOString(),
          });

        if (evalError) {
          console.error("Failed to create evaluation for", participant.email, evalError);
          throw evalError;
        }
      }

      const evaluationLink = `${baseUrl}/evaluation/${evaluationToken}`;
      
      // Process templates with variables
      const variables = {
        first_name: participant.first_name,
        training_name: trainingName,
        evaluation_link: evaluationLink,
        supports_url: supportsUrl,
      };

      const subject = processTemplate(subjectTemplate, variables);
      const contentText = processTemplate(contentTemplate, variables);
      const contentHtml = textToHtml(contentText);

      const htmlContent = `
        ${contentHtml}
        ${signature}
      `;

      console.log("Sending thank you email to:", participant.email);

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
        console.error("Resend error for", participant.email, ":", errorText);
        throw new Error(`Failed to send email to ${participant.email}: ${emailResponse.status}`);
      }

      results.push({ email: participant.email, success: true });
      
      // Wait 600ms between emails to respect Resend's rate limit (2/sec)
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log("Thank you emails sent successfully:", results.length);

    // Schedule follow-up emails for each participant
    console.log("Scheduling follow-up emails...");
    
    // Fetch email delay settings
    const { data: delaySettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["delay_google_review_days", "delay_video_testimonial_days", "delay_cold_evaluation_days", "delay_cold_evaluation_funder_days"]);
    
    let delayGoogleReview = 7;
    let delayVideoTestimonial = 14;
    let delayColdEvaluation = 30;
    let delayColdEvaluationFunder = 45;
    
    delaySettings?.forEach((s: { setting_key: string; setting_value: string | null }) => {
      if (s.setting_key === "delay_google_review_days" && s.setting_value) {
        delayGoogleReview = parseInt(s.setting_value, 10) || 7;
      }
      if (s.setting_key === "delay_video_testimonial_days" && s.setting_value) {
        delayVideoTestimonial = parseInt(s.setting_value, 10) || 14;
      }
      if (s.setting_key === "delay_cold_evaluation_days" && s.setting_value) {
        delayColdEvaluation = parseInt(s.setting_value, 10) || 30;
      }
      if (s.setting_key === "delay_cold_evaluation_funder_days" && s.setting_value) {
        delayColdEvaluationFunder = parseInt(s.setting_value, 10) || 45;
      }
    });
    
    // Calculate end date (use end_date if available, otherwise start_date)
    const endDate = training.end_date ? new Date(training.end_date) : new Date(training.start_date);
    
    // Schedule follow-up emails for each participant
    const emailsToSchedule: {
      training_id: string;
      participant_id: string;
      email_type: string;
      scheduled_for: string;
      status: string;
    }[] = [];
    
    for (const participant of participants) {
      // Check if emails are already scheduled for this participant
      const { data: existingEmails } = await supabase
        .from("scheduled_emails")
        .select("email_type")
        .eq("training_id", trainingId)
        .eq("participant_id", participant.id)
        .in("email_type", ["google_review", "video_testimonial", "cold_evaluation"]);
      
      const existingTypes = new Set(existingEmails?.map(e => e.email_type) || []);
      
      // Schedule google_review
      if (!existingTypes.has("google_review")) {
        const googleReviewDate = new Date(endDate);
        googleReviewDate.setDate(googleReviewDate.getDate() + delayGoogleReview);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "google_review",
          scheduled_for: googleReviewDate.toISOString(),
          status: "pending",
        });
      }
      
      // Schedule video_testimonial
      if (!existingTypes.has("video_testimonial")) {
        const videoTestimonialDate = new Date(endDate);
        videoTestimonialDate.setDate(videoTestimonialDate.getDate() + delayVideoTestimonial);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "video_testimonial",
          scheduled_for: videoTestimonialDate.toISOString(),
          status: "pending",
        });
      }
      
      // Schedule cold_evaluation
      if (!existingTypes.has("cold_evaluation")) {
        const coldEvaluationDate = new Date(endDate);
        coldEvaluationDate.setDate(coldEvaluationDate.getDate() + delayColdEvaluation);
        emailsToSchedule.push({
          training_id: trainingId,
          participant_id: participant.id,
          email_type: "cold_evaluation",
          scheduled_for: coldEvaluationDate.toISOString(),
          status: "pending",
        });
      }
    }
    
    // Insert scheduled emails
    if (emailsToSchedule.length > 0) {
      const { error: scheduleError } = await supabase
        .from("scheduled_emails")
        .insert(emailsToSchedule);
      
      if (scheduleError) {
        console.error("Error scheduling follow-up emails:", scheduleError);
      } else {
        console.log(`Scheduled ${emailsToSchedule.length} follow-up emails`);
      }
    }
    
    // Schedule funder reminder email if funder is different from sponsor
    if (!training.financeur_same_as_sponsor && training.financeur_name) {
      // Check if funder reminder is already scheduled
      const { data: existingFunderReminder } = await supabase
        .from("scheduled_emails")
        .select("id")
        .eq("training_id", trainingId)
        .eq("email_type", "funder_reminder")
        .single();
      
      if (!existingFunderReminder) {
        const funderReminderDate = new Date(endDate);
        funderReminderDate.setDate(funderReminderDate.getDate() + delayColdEvaluationFunder);
        
        const { error: funderScheduleError } = await supabase
          .from("scheduled_emails")
          .insert({
            training_id: trainingId,
            participant_id: null, // No participant - this is for the trainer
            email_type: "funder_reminder",
            scheduled_for: funderReminderDate.toISOString(),
            status: "pending",
          });
        
        if (funderScheduleError) {
          console.error("Error scheduling funder reminder:", funderScheduleError);
        } else {
          console.log("Scheduled funder reminder email");
        }
      }
    }

    // Log activity for each recipient
    const emailSubject = processTemplate(subjectTemplate, { training_name: trainingName });
    const emailContentBase = processTemplate(contentTemplate, { 
      training_name: trainingName,
      evaluation_link: "[Lien d'évaluation personnalisé]",
      supports_url: supportsUrl,
    });
    
    try {
      const logInserts = participants.map((p: any) => ({
        action_type: "thank_you_email_sent",
        recipient_email: p.email,
        details: {
          training_id: trainingId,
          training_name: trainingName,
          participant_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
          email_subject: emailSubject,
          email_content: processTemplate(contentTemplate, {
            first_name: p.first_name,
            training_name: trainingName,
            evaluation_link: "[Lien d'évaluation personnalisé]",
            supports_url: supportsUrl,
          }),
        },
      }));
      await supabase.from("activity_logs").insert(logInserts);
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: participants.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending thank you email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send thank you email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
