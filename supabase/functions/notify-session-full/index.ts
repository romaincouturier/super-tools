import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/bcc-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { trainingId } = await req.json();
    if (!trainingId) return createErrorResponse("trainingId is required", 400);

    // Find communication manager(s) by job_title
    const { data: commManagers } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, job_title")
      .ilike("job_title", "%communication%");

    if (!commManagers || commManagers.length === 0) {
      console.log("No communication manager found in profiles, skipping notification");
      return createJsonResponse({ skipped: true, reason: "no_communication_manager" });
    }

    const managerEmails = commManagers.map((m: any) => m.email).filter(Boolean);
    if (managerEmails.length === 0) {
      return createJsonResponse({ skipped: true, reason: "no_email" });
    }

    // Fetch training details
    const { data: training, error: tErr } = await supabase
      .from("trainings")
      .select("training_name, start_date, end_date, location, max_participants, client_name")
      .eq("id", trainingId)
      .single();

    if (tErr || !training) return createErrorResponse("Training not found", 404);

    // Count participants
    const { count } = await supabase
      .from("training_participants")
      .select("id", { count: "exact", head: true })
      .eq("training_id", trainingId);

    const bccList = await getBccList(supabase);
    let signature = "";
    try { signature = await getSigniticSignature(); } catch (_) { /* ignore */ }

    const startDate = training.start_date
      ? new Date(training.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "Non définie";

    const managerFirstName = commManagers[0].first_name || ""; 

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🎉 Session complète !</h2>
        <p>${managerFirstName ? `Bonjour ${managerFirstName},` : "Bonjour,"}</p>
        <p>La formation <strong>${training.training_name}</strong> a atteint son nombre maximum de participants.</p>
        <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Formation</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${training.training_name}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Date</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${startDate}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Lieu</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${training.location || "—"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Participants</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${count} / ${training.max_participants}</td></tr>
        </table>
        <p>Tu peux maintenant préparer la communication pour cette session.</p>
        ${signature}
      </div>
    `;

    const result = await sendEmail({
      to: managerEmails,
      subject: `🎉 Session complète — ${training.training_name} (${startDate})`,
      html,
      bcc: bccList,
      _trainingId: trainingId,
      _emailType: "session_full_notification",
    });

    return createJsonResponse({ success: result.success, recipientEmails: managerEmails });
  } catch (error) {
    console.error("Error in notify-session-full:", error);
    return createErrorResponse(error.message || "Internal error");
  }
});
