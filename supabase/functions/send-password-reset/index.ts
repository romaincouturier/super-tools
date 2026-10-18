import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { wrapEmailHtml } from "../_shared/templates.ts";
import { renderEditableEmail, ctaButton } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { generateHash, getClientIp } from "../_shared/crypto.ts";
import { passwordResetLink } from "../_shared/password-reset.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Le lien est construit depuis app_settings.app_url (passwordResetLink).
// Un éventuel redirectUrl du corps est ignoré : il n'est même pas lu.
interface RequestBody {
  email: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { email }: RequestBody = await req.json();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email invalide");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // RG-08 : quota d'envoi tenu côté serveur, partagé avec les liens
    // d'accès apprenant (3 par adresse, 10 par IP, par heure). Un lien de
    // réinitialisation n'était couvert par aucune limite avant ce correctif.
    const emailHash = await generateHash(email.trim().toLowerCase());
    const { data: allowed } = await supabaseClient.rpc("check_link_quota", {
      p_email_hash: emailHash,
      p_ip: getClientIp(req),
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = await passwordResetLink(supabaseClient, email);
    if (!resetLink) {
      // Ne rien révéler de l'existence du compte.
      return new Response(
        JSON.stringify({
          success: true,
          message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
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
    const tpl = EDITABLE_EMAIL_DEFAULTS.password_reset;
    const rendered = await renderEditableEmail(supabaseClient, {
      type: "password_reset",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      blocks: { reset_button: ctaButton("Réinitialiser mon mot de passe", resetLink) },
    });
    const emailResponse = await sendEmail({
      from: senderFrom,
      to: [email],
      bcc: bccList,
      subject: rendered.subject,
      html: wrapEmailHtml(rendered.html, signature),
      _emailType: "password_reset",
    });

    if (!emailResponse.success) {
      console.error("Email error:", emailResponse.error || "Unknown email error");
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
