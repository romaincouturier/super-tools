import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Send email with reset link
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SuperTools <romain@supertilt.fr>",
        to: [email],
        subject: "Réinitialisation de votre mot de passe SuperTools",
        html: `
          <h1>Réinitialisation de mot de passe</h1>
          <p>Vous avez demandé à réinitialiser votre mot de passe SuperTools.</p>
          <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
          <p style="margin: 30px 0;">
            <a href="${data.properties.action_link}" 
               style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          <p style="margin-top: 40px;">--<br>
          <strong>SuperTools</strong><br>
          Supertilt</p>
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
