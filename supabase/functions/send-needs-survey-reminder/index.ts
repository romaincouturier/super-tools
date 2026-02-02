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

// Fetch BCC settings from app_settings
async function getBccSettings(supabase: ReturnType<typeof createClient>): Promise<string[]> {
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
  
  const bccList: string[] = [];
  if (bccEnabled && bccEmailValue) {
    bccList.push(bccEmailValue);
  }
  bccList.push("supertilt@bcc.nocrm.io");
  
  console.log("BCC settings - enabled:", bccEnabled, "email:", bccEmailValue, "final list:", bccList.join(", "));
  return bccList;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participantId, trainingId } = await req.json();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch BCC settings
    const bccList = await getBccSettings(supabase);

    // Fetch participant and training info
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch training schedules for times
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Check if questionnaire exists and get token
    const { data: questionnaire, error: questionnaireError } = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("participant_id", participantId)
      .eq("training_id", trainingId)
      .single();

    let token: string;

    if (questionnaire) {
      token = questionnaire.token;
    } else {
      // Create new questionnaire with token if doesn't exist
      token = crypto.randomUUID();
      
      const { error: insertError } = await supabase
        .from("questionnaire_besoins")
        .insert({
          participant_id: participantId,
          training_id: trainingId,
          token,
          etat: "envoye",
          email: participant.email,
          prenom: participant.first_name,
          nom: participant.last_name,
          societe: participant.company,
          date_envoi: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error creating questionnaire:", insertError);
        throw new Error("Failed to create questionnaire");
      }

      // Update participant status
      await supabase
        .from("training_participants")
        .update({ 
          needs_survey_status: "envoye",
          needs_survey_sent_at: new Date().toISOString(),
          needs_survey_token: token,
        })
        .eq("id", participantId);
    }

    // Build questionnaire URL
    const baseUrl = "https://super-tools.lovable.app";
    const questionnaireUrl = `${baseUrl}/questionnaire/${token}`;

    // Get signature
    const signature = await getSigniticSignature();

    // Format training dates
    const startDate = new Date(training.start_date);
    const endDate = training.end_date ? new Date(training.end_date) : null;
    
    const formatDateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    
    let dateText: string;
    if (endDate && endDate.getTime() !== startDate.getTime()) {
      dateText = `du ${startDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} au ${endDate.toLocaleDateString("fr-FR", formatDateOptions)}`;
    } else {
      dateText = `le ${startDate.toLocaleDateString("fr-FR", formatDateOptions)}`;
    }

    // Get schedule times
    let scheduleText = "";
    if (schedules && schedules.length > 0) {
      const firstSchedule = schedules[0];
      const startTime = firstSchedule.start_time.slice(0, 5);
      const endTime = firstSchedule.end_time.slice(0, 5);
      scheduleText = ` (${startTime} - ${endTime})`;
    }

    // Build friendly email
    const firstName = participant.first_name || "";
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    const htmlContent = `
      <p>${greeting}</p>
      <p>J'espère que tu vas bien ! 😊</p>
      <p>Je me permets de te relancer au sujet du <strong>questionnaire de recueil des besoins</strong> pour la formation <strong>"${training.training_name}"</strong>.</p>
      <p>Pour rappel, cette formation aura lieu <strong>${dateText}${scheduleText}</strong> à <strong>${training.location}</strong>.</p>
      <p>Ce questionnaire me permet de personnaliser le contenu de la formation en fonction de tes attentes et de ton contexte. Ça prend environ 5 minutes, promis ! 🙂</p>
      <p style="margin: 24px 0;">
        <a href="${questionnaireUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          ✏️ Remplir le questionnaire
        </a>
      </p>
      <p>Si tu as des questions ou si tu rencontres un souci technique, n'hésite surtout pas à me contacter !</p>
      <p>Merci d'avance et à très bientôt,</p>
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
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [participant.email],
        bcc: bccList,
        subject: `Petit rappel : questionnaire pour la formation "${training.training_name}"`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Needs survey reminder sent to:", participant.email, result);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "needs_survey_reminder_sent",
        recipient_email: participant.email,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || null,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending needs survey reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send reminder";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
