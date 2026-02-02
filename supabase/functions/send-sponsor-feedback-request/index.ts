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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trainingId, scheduledEmailId } = await req.json();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Check if sponsor email exists
    if (!training.sponsor_email) {
      return new Response(
        JSON.stringify({ error: "No sponsor email configured for this training" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get participants count and evaluations stats
    const { count: participantsCount } = await supabase
      .from("training_participants")
      .select("*", { count: "exact", head: true })
      .eq("training_id", trainingId);

    const { data: evaluations } = await supabase
      .from("training_evaluations")
      .select("appreciation_generale, recommandation")
      .eq("training_id", trainingId)
      .eq("etat", "soumis");

    const evaluationsCount = evaluations?.length || 0;
    const avgScore = evaluations && evaluations.length > 0
      ? (evaluations.reduce((sum, e) => sum + (e.appreciation_generale || 0), 0) / evaluations.length).toFixed(1)
      : null;

    // Format dates
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const trainingDates = training.end_date && training.end_date !== training.start_date
      ? `du ${formatDate(training.start_date)} au ${formatDate(training.end_date)}`
      : `le ${formatDate(training.start_date)}`;

    // Get signature
    const signature = await getSigniticSignature();

    // Determine greeting based on formal address preference
    const sponsorName = training.sponsor_first_name || "";
    const useFormal = training.sponsor_formal_address !== false; // Default to formal
    const greeting = sponsorName
      ? (useFormal ? `Bonjour ${sponsorName},` : `Bonjour ${sponsorName},`)
      : "Bonjour,";

    // Build feedback URL (could be a Google Form or internal page)
    const feedbackBaseUrl = "https://super-tools.lovable.app";
    const feedbackUrl = `${feedbackBaseUrl}/sponsor-feedback/${trainingId}`;

    // Build email content
    const htmlContent = `
      <p>${greeting}</p>

      <p>La formation <strong>"${training.training_name}"</strong> s'est d\u00e9roul\u00e9e ${trainingDates} pour ${training.client_name}.</p>

      ${evaluationsCount > 0 ? `
      <p>Les retours des participants sont excellents :</p>
      <ul style="list-style: none; padding: 0; margin: 15px 0;">
        <li>\u2b50 <strong>Note moyenne :</strong> ${avgScore}/10</li>
        <li>\ud83d\udcca <strong>\u00c9valuations re\u00e7ues :</strong> ${evaluationsCount}/${participantsCount}</li>
      </ul>
      ` : `
      <p>Nous avons eu le plaisir d'accompagner ${participantsCount} participant(s) durant cette formation.</p>
      `}

      <p>Dans le cadre de notre d\u00e9marche qualit\u00e9 (certification Qualiopi), ${useFormal ? "nous souhaiterions recueillir votre" : "je souhaiterais recueillir ton"} avis sur cette action de formation.</p>

      <p style="margin: 25px 0;">
        <a href="${feedbackUrl}" style="display: inline-block; background-color: #eab308; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          \ud83d\udcdd Donner mon avis
        </a>
      </p>

      <p>Ce questionnaire ne ${useFormal ? "vous" : "te"} prendra que 2 minutes et nous permettra d'am\u00e9liorer continuellement nos formations.</p>

      <p>Merci pour ${useFormal ? "votre" : "ta"} confiance !</p>

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
        to: [training.sponsor_email],
        bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
        subject: `\ud83d\udcca Votre avis sur la formation "${training.training_name}"`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Sponsor feedback email sent:", emailResult);

    // Update training with sent timestamp
    await supabase
      .from("trainings")
      .update({ sponsor_feedback_sent_at: new Date().toISOString() })
      .eq("id", trainingId);

    // Update scheduled email status if provided
    if (scheduledEmailId) {
      await supabase
        .from("scheduled_emails")
        .update({
          status: "sent",
          sent_at: new Date().toISOString()
        })
        .eq("id", scheduledEmailId);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      action_type: "sponsor_feedback_request_sent",
      recipient_email: training.sponsor_email,
      details: {
        training_id: trainingId,
        training_name: training.training_name,
        client_name: training.client_name,
        sponsor_name: `${training.sponsor_first_name || ""} ${training.sponsor_last_name || ""}`.trim() || null,
        email_subject: `Votre avis sur la formation "${training.training_name}"`,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        recipient: training.sponsor_email,
        training_name: training.training_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-sponsor-feedback-request:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
