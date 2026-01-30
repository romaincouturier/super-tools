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
    <strong>Romain Arnoux</strong><br/>
    Supertilt - Formation professionnelle<br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
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

    // Check if questionnaire already exists
    let questionnaire = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("participant_id", participantId)
      .eq("training_id", trainingId)
      .single();

    let token: string;

    if (questionnaire.data) {
      // Use existing token
      token = questionnaire.data.token;
    } else {
      // Create new questionnaire with token
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

    // Update questionnaire status if it already existed
    if (questionnaire.data) {
      await supabase
        .from("questionnaire_besoins")
        .update({ 
          etat: "envoye",
          date_envoi: new Date().toISOString(),
        })
        .eq("id", questionnaire.data.id);
    }

    // Build questionnaire URL
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovableproject.com") 
      || "https://189bb4e6-abb7-4be6-96a9-7ff350879011.lovableproject.com";
    const questionnaireUrl = `${baseUrl}/questionnaire/${token}`;

    // Get signature
    const signature = await getSigniticSignature();

    // Format training date
    const startDate = new Date(training.start_date);
    const formattedDate = startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Build email
    const firstName = participant.first_name || "";
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    const htmlContent = `
      <p>${greeting}</p>
      <p>Vous êtes inscrit(e) à la formation <strong>"${training.training_name}"</strong> qui aura lieu le <strong>${formattedDate}</strong>.</p>
      <p>Afin de personnaliser cette formation à vos attentes, je vous invite à remplir un court questionnaire de recueil des besoins :</p>
      <p style="margin: 20px 0;">
        <a href="${questionnaireUrl}" style="display: inline-block; background-color: #eab308; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Accéder au questionnaire
        </a>
      </p>
      <p>Ce questionnaire vous prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à vos besoins spécifiques.</p>
      <p>Merci de le compléter <strong>au moins 2 jours avant la formation</strong>.</p>
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
        from: "Romain Arnoux <romain@supertilt.fr>",
        to: [participant.email],
        bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
        subject: `Questionnaire de recueil des besoins - ${training.training_name}`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Needs survey email sent to:", participant.email, result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending needs survey:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send needs survey";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
