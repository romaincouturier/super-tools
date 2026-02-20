import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { questionnaireId, trainingId, participantEmail, participantFirstName, accessibilityNeeds, trainingName } = await req.json();

    if (!participantEmail || !accessibilityNeeds) {
      return new Response(
        JSON.stringify({ error: "participantEmail and accessibilityNeeds are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch BCC settings and sender info
    const bccList = await getBccList();
    const senderFrom = await getSenderFrom();
    const senderEmail = await getSenderEmail();

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
      
      <blockquote style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #e6bc00; margin: 20px 0; font-style: italic;">
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
        from: senderFrom,
        to: [participantEmail],
        bcc: bccList,
        subject: `Tes besoins spécifiques pour la formation "${finalTrainingName}"`,
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
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending accessibility needs email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send accessibility needs email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
