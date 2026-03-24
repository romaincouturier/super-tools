import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check participant exists
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name")
      .ilike("email", email)
      .limit(1);

    if (!participants || participants.length === 0) {
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un lien vous a été envoyé." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create magic link
    const { data: link, error } = await supabase
      .from("learner_magic_links")
      .insert({ email: email.toLowerCase() })
      .select("token")
      .single();

    if (error) throw error;

    const appUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "").includes("localhost")
      ? "http://localhost:5173"
      : `https://${Deno.env.get("APP_DOMAIN") || "super-tools.lovable.app"}`;

    const portalUrl = `${appUrl}/espace-apprenant?token=${link.token}`;
    const firstName = participants[0].first_name || "Apprenant";

    await sendEmail({
      to: email,
      subject: "Votre accès à l'espace apprenant",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
          <h1 style="color: #101820; font-size: 24px;">Bonjour ${firstName} 👋</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Vous avez demandé l'accès à votre espace apprenant. Cliquez sur le bouton ci-dessous pour y accéder :
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background-color: #ffd100; color: #101820; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Accéder à mon espace
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.</p>
        </div>
      `,
      _emailType: "learner_magic_link",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Si un compte existe, un lien vous a été envoyé." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
