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

// Replace template variables
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// Send notification to sponsor (intra-enterprise)
async function sendSponsorNotification(
  resendApiKey: string,
  sponsorEmail: string,
  sponsorFirstName: string | null,
  sponsorFormalAddress: boolean,
  trainingName: string,
  participantsList: string[],
  signature: string
): Promise<void> {
  const greeting = sponsorFormalAddress 
    ? 'Bonjour,' 
    : (sponsorFirstName ? `Bonjour ${sponsorFirstName},` : 'Bonjour,');
  
  const participantsFormatted = participantsList.map(p => `<li>${p}</li>`).join('');
  
  const htmlContent = `
    <p>${greeting}</p>
    <p>Nous avons le plaisir de vous informer que les convocations à la formation <strong>${trainingName}</strong> ont été envoyées aux participants suivants :</p>
    <ul style="margin-left: 20px;">
      ${participantsFormatted}
    </ul>
    <p>Chaque participant a reçu un email contenant toutes les informations pratiques relatives à la formation.</p>
    <p>Nous restons à votre disposition pour toute question.</p>
    <p>Bien cordialement,</p>
    ${signature}
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [sponsorEmail],
      bcc: ["supertilt@bcc.nocrm.io"],
      subject: `Convocations envoyées - ${trainingName}`,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error sending sponsor notification:", errorText);
    // Don't throw - this is a secondary notification
  } else {
    console.log("Sponsor notification sent to:", sponsorEmail);
  }
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

    // Fetch participant with sponsor info
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

    const isInterEntreprise = training.format_formation === "inter-entreprises";

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
      // Use template but ensure "Convocation" is in the subject
      const templateSubject = replaceVariables(template.subject, variables);
      // If subject doesn't already contain "Convocation", prepend it
      subject = templateSubject.toLowerCase().includes('convocation') 
        ? templateSubject 
        : `Convocation - ${templateSubject}`;
      htmlContent = replaceVariables(template.html_content, variables) + signature;
    } else {
      // Fallback default content - warm welcome email with convocation mention
      const greeting = participant.first_name ? `Bonjour ${participant.first_name},` : 'Bonjour,';
      subject = `Convocation - Formation ${training.training_name}`;
      htmlContent = `
        <p>${greeting}</p>
        <p>C'est avec grand plaisir que nous vous confirmons votre inscription à la formation <strong>${training.training_name}</strong>.</p>
        
        <p style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; font-weight: 500;">
          📋 Ce mail constitue votre convocation à la formation.
        </p>
        
        <p><strong>📅 Informations pratiques :</strong></p>
        <ul style="margin-left: 20px; list-style: none; padding-left: 0;">
          ${scheduleStr ? `<li style="margin-bottom: 8px;"><strong>Horaires :</strong><br/>${scheduleStr}</li>` : `<li style="margin-bottom: 8px;"><strong>Date :</strong> ${trainingDate}</li>`}
          <li style="margin-bottom: 8px;"><strong>Lieu :</strong> ${training.location}</li>
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
    console.log("Is inter-entreprise:", isInterEntreprise);

    // Build CC list for inter-enterprise (sponsor of the participant)
    const ccList: string[] = [];
    if (isInterEntreprise && participant.sponsor_email) {
      ccList.push(participant.sponsor_email);
      console.log("CC to participant sponsor:", participant.sponsor_email);
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [participant.email],
        cc: ccList.length > 0 ? ccList : undefined,
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

    // For intra-enterprise: check if we should notify the sponsor
    // We do this by checking if all participants have now received their welcome email
    if (!isInterEntreprise && training.sponsor_email) {
      // Get all participants for this training
      const { data: allParticipants } = await supabase
        .from("training_participants")
        .select("id, first_name, last_name, email, needs_survey_status")
        .eq("training_id", trainingId);

      if (allParticipants) {
        // Check if all participants have received welcome email (including the one we just sent)
        const allConvoked = allParticipants.every(p => 
          p.id === participantId || 
          p.needs_survey_status === "accueil_envoye" || 
          p.needs_survey_status === "envoye" ||
          p.needs_survey_status === "en_cours" ||
          p.needs_survey_status === "complete" ||
          p.needs_survey_status === "valide_formateur"
        );

        // If this is the last participant to be convoked, notify sponsor
        if (allConvoked) {
          const participantNames = allParticipants.map(p => {
            const name = p.first_name || p.last_name 
              ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
              : p.email;
            return name;
          });

          await sendSponsorNotification(
            RESEND_API_KEY,
            training.sponsor_email,
            training.sponsor_first_name,
            training.sponsor_formal_address,
            training.training_name,
            participantNames,
            signature
          );
        }
      }
    }

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
