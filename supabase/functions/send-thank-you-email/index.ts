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

    const trainingName = training.training_name;
    const supportsUrl = training.supports_url || "";
    
    // Base URL for evaluation links
    const baseUrl = "https://super-tools.lovable.app";

    // Create evaluations and send individual emails to each participant
    const emailPromises = participants.map(async (participant: any) => {
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
      
      const supportsSection = supportsUrl 
        ? `<p>Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :</p>
           <p><a href="${supportsUrl}" style="color: #0066cc; text-decoration: underline;">Accéder aux supports de formation</a></p>`
        : "";

      const htmlContent = `
        <p>Bonjour${participant.first_name ? ` ${participant.first_name}` : ""},</p>
        
        <p>Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation <strong>${trainingName}</strong>.</p>
        
        <p>Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation.</p>
        
        <p><a href="${evaluationLink}" style="color: #0066cc; text-decoration: underline; font-weight: bold;">Accéder au questionnaire d'évaluation</a></p>
        
        ${supportsSection}
        
        <p>Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.</p>
        
        <p>Je vous souhaite une bonne journée</p>
        
        ${signature}
      `;

      const subject = `Merci pour votre participation à la formation ${trainingName}`;

      console.log("Sending thank you email to:", participant.email);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Romain Couturier <romain@supertilt.fr>",
          to: [participant.email],
          bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Resend error for", participant.email, ":", errorText);
        throw new Error(`Failed to send email to ${participant.email}: ${emailResponse.status}`);
      }

      return { email: participant.email, success: true };
    });

    const results = await Promise.all(emailPromises);
    console.log("Thank you emails sent successfully:", results.length);

    // Log activity for each recipient
    try {
      const logInserts = participants.map((p: any) => ({
        action_type: "thank_you_email_sent",
        recipient_email: p.email,
        details: {
          training_id: trainingId,
          training_name: trainingName,
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
