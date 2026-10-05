import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { renderEditableEmail } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

interface RequestBody {
  learnerEmail: string;
  trainingName: string;
  courseTitle: string;
  adminEmail: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { learnerEmail, trainingName, courseTitle, adminEmail }: RequestBody = await req.json();

    const [signature, senderFrom, bccList] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
      getBccList(),
    ]);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tpl = EDITABLE_EMAIL_DEFAULTS.coached_formula_request;
    const email = await renderEditableEmail(supabase, {
      type: "coached_formula_request",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: { learner_email: learnerEmail, training_name: trainingName, course_title: courseTitle },
    });

    await sendEmail({
      from: senderFrom,
      to: [adminEmail],
      bcc: bccList,
      subject: email.subject,
      html: `${email.html}\n${signature}`,
      _emailType: "coached_formula_request",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("request-coached-formula error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
