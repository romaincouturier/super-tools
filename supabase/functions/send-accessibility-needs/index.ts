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
    const { questionnaireId, trainingId, participantEmail, participantFirstName, accessibilityNeeds, trainingName } = await req.json();

    if (!participantEmail || !accessibilityNeeds) {
      return new Response(
        JSON.stringify({ error: "participantEmail and accessibilityNeeds are required" }),
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

    // Fetch training name if not provided
    let finalTrainingName = trainingName || "Formation";
    if (!trainingName && trainingId) {
      const { data: training } = await supabase
        .from("trainings")
        .select("training_name")
        .eq("id", trainingId)
        .single();
      
      if (training) {
        finalTrainingName = training.training_name;
      }
    }

    // Get signature
    const signature = await getSigniticSignature();

    const firstName = participantFirstName || "";
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    const htmlContent = `
      <p>${greeting}</p>
      
      <p>Merci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.</p>

      <p>J'ai bien pris en compte ton besoin spécifique :</p>
      
      <blockquote style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #eab308; margin: 20px 0; font-style: italic;">
        ${accessibilityNeeds}
      </blockquote>

      <p>Je souhaite t'offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à tes besoins.</p>

      <p>À cet effet, pourrais-tu m'indiquer les adaptations nécessaires que je pourrais mettre en place pour te permettre de suivre la formation dans les meilleures conditions ? Par exemple, aurais-tu besoin d'un matériel particulier, d'aménagements horaires, d'un accompagnement spécifique, etc. ?</p>

      <p>Tes suggestions et recommandations me seront précieuses pour préparer au mieux cette formation et te garantir un apprentissage optimal.</p>

      <p>Dans l'attente de ton retour, je reste à ta disposition pour toute question ou information complémentaire.</p>

      <p>Bonne journée,</p>
      
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
        subject: `Tes besoins spécifiques pour la formation "${finalTrainingName}"`,
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
    console.log("Accessibility needs email sent to:", participantEmail, result);

    // Log activity
    const emailSubject = `Tes besoins spécifiques pour la formation "${finalTrainingName}"`;
    const emailContentText = `${greeting}\n\nMerci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.\n\nJ'ai bien pris en compte ton besoin spécifique :\n"${accessibilityNeeds}"\n\nJe souhaite t'offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à tes besoins.\n\nPourrais-tu m'indiquer les adaptations nécessaires que je pourrais mettre en place pour te permettre de suivre la formation dans les meilleures conditions ?\n\nDans l'attente de ton retour, je reste à ta disposition pour toute question ou information complémentaire.`;
    
    try {
      await supabase.from("activity_logs").insert({
        action_type: "accessibility_needs_email_sent",
        recipient_email: participantEmail,
        details: {
          training_id: trainingId,
          training_name: finalTrainingName,
          questionnaire_id: questionnaireId,
          accessibility_needs: accessibilityNeeds,
          email_subject: emailSubject,
          email_content: emailContentText,
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
    console.error("Error sending accessibility needs email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send accessibility needs email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
