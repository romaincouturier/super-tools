import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate, textToHtml } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
// Default templates
const DEFAULT_SUBJECT_TU = "Tes besoins spécifiques pour la formation \"{{training_name}}\"";
const DEFAULT_SUBJECT_VOUS = "Vos besoins spécifiques pour la formation \"{{training_name}}\"";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.

J'ai bien pris en compte ton besoin spécifique :
"{{accessibility_needs}}"

Je souhaite t'offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à tes besoins.

Pourrais-tu m'indiquer les adaptations nécessaires que je pourrais mettre en place pour te permettre de suivre la formation dans les meilleures conditions ?

Dans l'attente de ton retour, je reste à ta disposition pour toute question ou information complémentaire.`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.

J'ai bien pris en compte votre besoin spécifique :
"{{accessibility_needs}}"

Je souhaite vous offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à vos besoins.

Pourriez-vous m'indiquer les adaptations nécessaires que je pourrais mettre en place pour vous permettre de suivre la formation dans les meilleures conditions ?

Dans l'attente de votre retour, je reste à votre disposition pour toute question ou information complémentaire.`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { questionnaireId, trainingId, participantEmail, participantFirstName, accessibilityNeeds, trainingName, formalAddress } = await req.json();

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

    const supabase = getSupabaseClient();

    // Fetch training to get formal address setting
    let useTutoiement = formalAddress === false;
    let finalTrainingName = trainingName || "Formation";
    
    if (trainingId) {
      const { data: training } = await supabase
        .from("trainings")
        .select("training_name, participants_formal_address")
        .eq("id", trainingId)
        .single();
      
      if (training) {
        finalTrainingName = training.training_name || finalTrainingName;
        useTutoiement = training.participants_formal_address === false;
      }
    }

    const templateTypeSuffix = useTutoiement ? "_tu" : "_vous";
    const templateType = `accessibility_needs${templateTypeSuffix}`;

    // Fetch template, BCC, signature, and sender in parallel
    const [templateResult, bccList, signature, senderFrom, senderEmail] = await Promise.all([
      supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", templateType)
        .maybeSingle(),
      getBccList(),
      getSigniticSignature(),
      getSenderFrom(),
      getSenderEmail(),
    ]);

    const customTemplate = templateResult.data;
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", useTutoiement ? "tutoiement" : "vouvoiement");

    // Process template
    const variables = {
      first_name: participantFirstName || null,
      training_name: finalTrainingName,
      accessibility_needs: accessibilityNeeds,
    };

    const emailSubject = processTemplate(subjectTemplate, variables, false);
    const contentText = processTemplate(contentTemplate, variables, false);
    const contentHtml = textToHtml(contentText);
    const htmlContent = `${contentHtml}\n${signature}`;

    // Send email
    const result = await sendEmail({
      from: senderFrom,
      to: [participantEmail],
      bcc: bccList,
      subject: emailSubject,
      html: htmlContent,
      replyTo: senderEmail,
      _emailType: "accessibility_needs",
      _trainingId: trainingId || undefined,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log("Accessibility needs email sent to:", participantEmail, result.id);

    // Log activity
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
          email_content: contentText,
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
