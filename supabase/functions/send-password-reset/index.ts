import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderFrom } from "../_shared/email-settings.ts";
import { getBccList } from "../_shared/bcc-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  email: string;
  redirectUrl: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: RequestBody = await req.json();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email invalide");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate password reset link
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("Generate link error:", error);
      // Don't reveal if user exists or not for security
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.properties?.action_link) {
      console.error("No action link generated");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Signitic signature and BCC list
    const [signature, senderFrom, bccList] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
      getBccList(),
    ]);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFrom,
        to: [email],
        bcc: bccList,
        subject: "Réinitialisation de votre mot de passe SuperTools",
        html: `
          <p>Bonjour,</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe SuperTools.</p>
          <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
          <p style="margin: 30px 0;">
            <a href="${data.properties.action_link}" 
               style="background-color: #eab308; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          ${signature}
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Email error:", errorText);
    }

    console.log(`Password reset email sent to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
