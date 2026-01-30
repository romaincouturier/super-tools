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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionnaireId, trainingId, participantEmail, participantFirstName, formatFormation } = await req.json();

    if (!participantEmail || !trainingId) {
      return new Response(
        JSON.stringify({ error: "participantEmail and trainingId are required" }),
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

    // Fetch training info if not provided
    let trainingName = "";
    let isOnline = formatFormation === "en_ligne" || formatFormation === "online";
    
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, format_formation, location")
      .eq("id", trainingId)
      .single();

    if (!trainingError && training) {
      trainingName = training.training_name;
      // Check if online based on format or location
      isOnline = training.format_formation === "en_ligne" || 
                 training.format_formation === "online" ||
                 (training.location && training.location.toLowerCase().includes("en ligne"));
    }

    // Get signature
    const signature = await getSigniticSignature();

    const firstName = participantFirstName || "participant";

    // Build email content based on format
    let formatSpecificContent = "";
    
    if (isOnline) {
      formatSpecificContent = `
        <p>Je te laisse continuer ton parcours de formation à partir de ton espace personnel.</p>
      `;
    } else {
      formatSpecificContent = `
        <p>Je te donne rendez-vous le jour J, ce qui te laisse le temps suffisant pour préparer toutes tes questions et libérer ton agenda pour être dédié à 100% :-)</p>
        <p>Si tu as un empêchement ou un retard pour arriver, préviens-moi, je verrai comment on peut s'adapter à cette situation :-)</p>
      `;
    }

    const htmlContent = `
      <p>Bonjour ${firstName},</p>
      
      <p>Merci d'avoir rempli le formulaire de recueil des besoins pour la formation. C'est tout bon !</p>
      
      ${formatSpecificContent}
      
      <p>Tu peux aussi flâner sur notre <a href="https://www.youtube.com/c/SuperTilt">chaîne YouTube</a> et notre <a href="https://supertilt.fr/blog/">blog</a> sur lesquels tu y trouveras des éléments en rapport avec le programme.</p>
      
      <p>Si tu as la moindre question, je reste à ta disposition par téléphone : <strong>06 66 98 76 35</strong> ou par mail <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a></p>
      
      <p>À très vite,</p>
      
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
        to: [participantEmail],
        bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
        subject: `Questionnaire complété - ${trainingName}`,
        html: htmlContent,
        reply_to: "romain@supertilt.fr",
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Questionnaire confirmation email sent to:", participantEmail, result);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "questionnaire_confirmation_sent",
        recipient_email: participantEmail,
        details: {
          training_id: trainingId,
          training_name: trainingName,
          questionnaire_id: questionnaireId,
          format: isOnline ? "en_ligne" : "presentiel",
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
    console.error("Error sending questionnaire confirmation email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send confirmation email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
