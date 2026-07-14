import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

const VERSION = "notify-survey-response@2026-06-02.1";

serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const { responseId, surveyId } = await req.json().catch(() => ({}));
    if (!responseId || !surveyId) {
      return new Response(
        JSON.stringify({ error: "Missing responseId or surveyId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load survey
    const { data: survey } = await supabase
      .from("mission_surveys")
      .select("id, title, mission_id, mission_page_id, created_by")
      .eq("id", surveyId)
      .maybeSingle();

    if (!survey) {
      return new Response(
        JSON.stringify({ error: "Survey not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load response
    const { data: response } = await supabase
      .from("mission_survey_responses")
      .select("respondent_name, respondent_email")
      .eq("id", responseId)
      .maybeSingle();

    // Resolve staff recipient email
    let staffEmail: string | null = null;
    if (survey.created_by && /@/.test(survey.created_by)) {
      staffEmail = survey.created_by.toLowerCase();
    } else {
      // Fallback: mission owner's profile email
      const { data: mission } = await supabase
        .from("missions")
        .select("created_by")
        .eq("id", survey.mission_id)
        .maybeSingle();
      if (mission?.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", mission.created_by)
          .maybeSingle();
        staffEmail = profile?.email?.toLowerCase() ?? null;
      }
    }

    if (!staffEmail) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no_staff_email", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const respondentLabel =
      (response?.respondent_name && response.respondent_name.trim()) ||
      response?.respondent_email ||
      "Un répondant anonyme";

    const urls = await getAppUrls();
    const link = `${urls.app_url}/missions/${survey.mission_id}`;

    const senderFrom = await getSenderFrom();
    const signature = await getSigniticSignature();
    const bccList = await getBccList();

    const subject = `📝 Nouvelle réponse au sondage « ${survey.title} »`;
    const bodyHtml = `
      <p>Bonjour,</p>
      <p><strong>${respondentLabel}</strong> vient de répondre à votre sondage <strong>« ${survey.title} »</strong>.</p>
      ${emailButton("Voir les résultats du sondage", link)}
      <p>À bientôt,<br>L'équipe SuperTilt</p>
    `;
    const html = wrapEmailHtml(bodyHtml, signature);

    const result = await sendEmail({
      from: senderFrom,
      to: [staffEmail],
      bcc: bccList,
      subject,
      html,
      _emailType: "survey_response_notification",
    });

    return new Response(
      JSON.stringify({ success: !!result.success, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-survey-response error", err);
    await reportEdgeError(err, { fn: "notify-survey-response" });
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
