import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody } from "../_shared/validation.ts";

const requestSchema = z.object({
  questionnaireId: z.string().optional(),
  participantEmail: z.string().email(),
  participantName: z.string().min(1),
  trainingName: z.string().min(1),
  prerequisValidations: z.record(z.string()).optional(),
});

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { data, error: validationError } = await parseBody(req, requestSchema);
    if (validationError) return validationError;

    const { questionnaireId, participantEmail, participantName, trainingName, prerequisValidations } = data;

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
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending prerequisite warning email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send prerequisite warning email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
