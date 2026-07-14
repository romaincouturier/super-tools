import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

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

    await sendEmail({
      from: senderFrom,
      to: [learnerEmail],
      subject: `Nouveau message dans votre espace — ${courseTitle}`,
      html: `
        <p>Bonjour,</p>
        <p>Vous avez reçu un nouveau message de votre formateur concernant votre e-learning <strong>${courseTitle}</strong>.</p>
        ${emailButton("Voir mon message", portalUrl)}
        <p style="color:#666;font-size:14px;">Si vous ne souhaitez plus recevoir ces notifications, contactez votre formateur.</p>
        ${signature}
      `,
      _emailType: "lms_message_notification",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("notify-learner-lms-message error:", error);
    await reportEdgeError(error, { fn: "notify-learner-lms-message" });
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
