import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const firstName = participantName.split(" ")[0] || participantName;

    // Try to load template (always use "vous" for prerequis_warning)
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", "prerequis_warning_vous")
      .maybeSingle();

    let subject: string;
    let htmlContent: string;

    if (template) {
      const vars = {
        first_name: firstName,
        training_name: trainingName,
        prereq_list: `<div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #eab308; margin: 20px 0;">${prereqList}</div>`,
      };
      subject = processTemplate(template.subject, vars, false);
      const body = processTemplate(template.html_content, vars, false);
      htmlContent = body
        .split(/\n\n+/)
        .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("") + "\n" + signature;
    } else {
      subject = `Prérequis de la formation "${trainingName}" - Faisons le point`;
      htmlContent = `
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
    }

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
        subject,
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
