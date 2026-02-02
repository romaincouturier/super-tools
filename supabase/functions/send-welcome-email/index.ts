import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature
async function getSigniticSignature(): Promise<string> {
  try {
    const SIGNITIC_API_KEY = Deno.env.get("SIGNITIC_API_KEY");
    if (!SIGNITIC_API_KEY) {
      console.warn("SIGNITIC_API_KEY not configured, using default signature");
      return getDefaultSignature();
    }

    const response = await fetch("https://api.signitic.com/v1/signature", {
      headers: {
        "Authorization": `Bearer ${SIGNITIC_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Signitic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.html || getDefaultSignature();
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

// Replace template variables
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participantId, trainingId, templateId } = await req.json();

    if (!participantId || !trainingId) {
      return new Response(
        JSON.stringify({ error: "participantId and trainingId are required" }),
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

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch schedules for the training
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Fetch email template (use default welcome template if not specified)
    let template;
    if (templateId) {
      const { data: templateData } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      template = templateData;
    } else {
      // Get default welcome template
      const { data: templateData } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "welcome")
        .eq("is_default", true)
        .single();
      template = templateData;
    }

    // Build schedule string
    const scheduleStr = schedules?.map(s => {
      const date = new Date(s.day_date).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      return `${date} : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
    }).join('<br/>') || '';

    // Format training date
    const trainingDate = new Date(training.start_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Build training summary page URL
    const trainingSummaryUrl = `https://super-tools.lovable.app/formation-info/${trainingId}`;

    // Template variables
    const variables: Record<string, string> = {
      participant_first_name: participant.first_name || '',
      participant_last_name: participant.last_name || '',
      participant_email: participant.email,
      participant_company: participant.company || '',
      training_name: training.training_name,
      training_date: trainingDate,
      training_location: training.location,
      training_schedule: scheduleStr,
      client_name: training.client_name,
      training_summary_url: trainingSummaryUrl,
    };

    // Get Signitic signature
    const signature = await getSigniticSignature();

    let subject: string;
    let htmlContent: string;

    if (template) {
      subject = replaceVariables(template.subject, variables);
      htmlContent = replaceVariables(template.html_content, variables) + signature;
    } else {
      // Fallback default content - warm welcome email
      const greeting = participant.first_name ? `Bonjour ${participant.first_name},` : 'Bonjour,';
      subject = `🎉 Bienvenue à la formation ${training.training_name} !`;
      htmlContent = `
        <p>${greeting}</p>
        <p>C'est avec grand plaisir que nous vous confirmons votre inscription à la formation <strong>${training.training_name}</strong> !</p>
        
        <p><strong>📅 Dates et horaires :</strong></p>
        <ul style="margin-left: 20px;">
          <li><strong>Date :</strong> ${trainingDate}</li>
          ${scheduleStr ? `<li><strong>Horaires :</strong><br/>${scheduleStr}</li>` : ''}
          <li><strong>Lieu :</strong> ${training.location}</li>
        </ul>
        
        <p><strong>📋 Prochaines étapes :</strong></p>
        <p>Dans les prochains jours, vous recevrez un email de recueil de vos besoins pour cette formation. Ce questionnaire nous permettra de personnaliser au mieux le contenu en fonction de vos attentes.</p>
        
        <p><strong>📍 Retrouvez toutes les informations pratiques :</strong></p>
        <p>En attendant, vous pouvez consulter l'ensemble des informations de la formation (programme, accès, contact du formateur) sur cette page :</p>
        <p style="margin: 20px 0;">
          <a href="${trainingSummaryUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Voir les informations de la formation
          </a>
        </p>
        
        <p>Nous restons à votre disposition pour toute question.</p>
        <p>À très bientôt ! 🙂</p>
        ${signature}
      `;
    }

    console.log("Sending welcome email to:", participant.email);
    console.log("Subject:", subject);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [participant.email],
        bcc: ["supertilt@bcc.nocrm.io"],
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Welcome email sent successfully:", result);

    // Update participant status
    await supabase
      .from("training_participants")
      .update({ 
        needs_survey_status: "accueil_envoye",
        needs_survey_sent_at: new Date().toISOString()
      })
      .eq("id", participantId);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending welcome email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send welcome email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
