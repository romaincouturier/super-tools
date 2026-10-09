import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { renderEditableEmail } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

interface RequestBody {
  learnerEmail: string;
  courseTitle: string;
  portalUrl: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { learnerEmail, courseTitle, portalUrl }: RequestBody = await req.json();

    const [signature, senderFrom] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
    ]);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tpl = EDITABLE_EMAIL_DEFAULTS.lms_message_notification;
    const email = await renderEditableEmail(supabase, {
      type: "lms_message_notification",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: { course_title: courseTitle },
      blocks: { message_button: emailButton("Voir mon message", portalUrl) },
    });

    await sendEmail({
      from: senderFrom,
      to: [learnerEmail],
      subject: email.subject,
      html: `${email.html}\n${signature}`,
      _emailType: "lms_message_notification",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("notify-learner-lms-message error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
