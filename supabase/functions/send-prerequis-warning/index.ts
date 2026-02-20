import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionnaireId, participantEmail, participantName, trainingName, prerequisValidations } = await req.json();

    if (!participantEmail || !trainingName) {
      return new Response(
        JSON.stringify({ error: "participantEmail and trainingName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Get signature and sender info
    const [signature, senderFrom, senderEmail, bccList] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
      getSenderEmail(),
      getBccList(),
    ]);

    // Build list of unvalidated prerequisites
    const unvalidatedPrereqs: string[] = [];
    if (prerequisValidations && typeof prerequisValidations === "object") {
      for (const [prereq, status] of Object.entries(prerequisValidations)) {
        if (status === "non" || status === "partiellement") {
          unvalidatedPrereqs.push(`• ${prereq} (${status === "non" ? "Non validé" : "Partiellement validé"})`);
        }
      }
    }

    const prereqList = unvalidatedPrereqs.length > 0 
      ? unvalidatedPrereqs.join("<br/>") 
      : "Certains prérequis n'ont pas été validés.";

    // Build email
    const firstName = participantName.split(" ")[0] || participantName;

    const htmlContent = `
      <p>Bonjour ${firstName},</p>
      
      <p>Merci d'avoir complété le questionnaire de recueil des besoins pour la formation <strong>"${trainingName}"</strong>.</p>
      
      <p>J'ai bien noté que certains prérequis de la formation ne sont pas entièrement validés de votre côté :</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #eab308; margin: 20px 0;">
        ${prereqList}
      </div>
      
      <p>Pas d'inquiétude ! Ces prérequis sont là pour vous aider à tirer le meilleur parti de la formation, mais ils ne sont pas forcément bloquants.</p>
      
      <p><strong>Pourriez-vous me répondre en m'expliquant ce qui vous manque ?</strong></p>
      
      <p>Ensemble, nous verrons comment adapter la formation à votre situation ou, si nécessaire, comment vous préparer au mieux avant la session.</p>
      
      <p>Je reste à votre disposition pour en discuter.</p>
      
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
        from: senderFrom,
        to: [participantEmail],
        cc: [senderEmail],
        bcc: bccList,
        subject: `Prérequis de la formation "${trainingName}" - Faisons le point`,
        html: htmlContent,
        reply_to: senderEmail,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Prerequisite warning email sent to:", participantEmail, result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending prerequisite warning email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send prerequisite warning email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
