import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
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

    await sendEmail({
      from: senderFrom,
      to: [adminEmail],
      bcc: bccList,
      subject: `Demande de formule coachée — ${learnerEmail}`,
      html: `
        <p>Bonjour,</p>
        <p>L'apprenant <strong>${learnerEmail}</strong> souhaite passer à la formule coachée.</p>
        <p><strong>Formation :</strong> ${trainingName}</p>
        <p><strong>E-Learning :</strong> ${courseTitle}</p>
        <p>Merci de le contacter pour lui proposer une formule coachée adaptée.</p>
        ${signature}
      `,
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
