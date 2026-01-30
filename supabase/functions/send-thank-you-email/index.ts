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
    const { trainingId } = await req.json();

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

    // Fetch participants
    const { data: participants, error: participantsError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", trainingId);

    if (participantsError || !participants || participants.length === 0) {
      throw new Error("No participants found for this training");
    }

    // Get Signitic signature
    const signature = await getSigniticSignature();

    // Build email content
    const trainingName = training.training_name;
    const evaluationLink = training.evaluation_link;
    const supportsUrl = training.supports_url || "";

    const supportsSection = supportsUrl 
      ? `<p>Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :</p>
         <p><a href="${supportsUrl}" style="color: #0066cc; text-decoration: underline;">Accéder aux supports de formation</a></p>`
      : "";

    const htmlContent = `
      <p>Bonjour à toutes et à tous,</p>
      
      <p>Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation <strong>${trainingName}</strong>.</p>
      
      <p>Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation.</p>
      
      <p><a href="${evaluationLink}" style="color: #0066cc; text-decoration: underline; font-weight: bold;">Accéder au questionnaire d'évaluation</a></p>
      
      ${supportsSection}
      
      <p>Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.</p>
      
      <p>Je vous souhaite une bonne journée</p>
      
      ${signature}
    `;

    const subject = `Merci pour votre participation à la formation ${trainingName}`;
    const recipientEmails = participants.map(p => p.email);

    console.log("Sending thank you email to:", recipientEmails.length, "participants");
    console.log("Subject:", subject);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Arnoux <romain@supertilt.fr>",
        to: recipientEmails,
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
    console.log("Thank you email sent successfully:", result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.id,
        recipientCount: recipientEmails.length 
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
