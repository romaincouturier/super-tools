import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderEmail, getSenderFrom } from "../_shared/email-settings.ts";
import { sendEmail } from "../_shared/resend.ts";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ADMIN_EMAIL is fetched dynamically via getSenderEmail()
const ALERT_THRESHOLD = 3; // Envoyer une alerte après 3 échecs consécutifs
const UNAUTHORIZED_ALERT_COOLDOWN_MINUTES = 60; // Cooldown entre alertes pour un même email inconnu

interface RequestBody {
  email: string;
  success: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const [ADMIN_EMAIL, senderFrom] = await Promise.all([getSenderEmail(), getSenderFrom()]);

    const { email, success }: RequestBody = await req.json();

    // Récupérer l'IP et le user agent
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Enregistrer la tentative
    const { error: insertError } = await supabase
      .from("login_attempts")
      .insert({
        ip_address: ipAddress,
        email: email.toLowerCase(),
        success,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error("Error logging attempt:", insertError);
      throw insertError;
    }

    // Si échec, vérifier si l'email existe dans le système
    if (!success) {
      // Vérifier si l'utilisateur existe dans auth.users
      const { data: userExists, error: rpcError } = await supabase
        .rpc("check_user_exists_by_email", { target_email: email.toLowerCase() });

      if (rpcError) {
        console.error("Error checking user existence:", rpcError);
      }

      // Si l'email n'existe pas dans le système, envoyer une alerte immédiate
      if (userExists === false) {
        // Vérifier le cooldown : ne pas envoyer si une alerte a déjà été envoyée récemment pour cet email
        const cooldownStart = new Date(Date.now() - UNAUTHORIZED_ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString();
        const { data: recentUnauthorizedAttempts } = await supabase
          .from("login_attempts")
          .select("id")
          .eq("email", email.toLowerCase())
          .eq("success", false)
          .gte("attempted_at", cooldownStart);

        const isFirstAttemptInWindow = (recentUnauthorizedAttempts?.length || 0) <= 1;

        if (isFirstAttemptInWindow) {
          console.log(`Unauthorized email detected: ${email}, sending alert...`);

          try {
            const now = new Date();
            const formattedDate = now.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const formattedTime = now.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const maskedIp = ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");

            await sendEmail({
              from: senderFrom,
              to: [ADMIN_EMAIL],
              subject: "🚫 Alerte sécurité SuperTools - Tentative de connexion non autorisée",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                  <h1 style="color: #b91c1c;">🚫 Tentative de connexion non autorisée</h1>
                  <p><strong>Une tentative de connexion a été détectée avec un email qui n'existe pas dans le système.</strong></p>

                  <div style="background-color: #fef2f2; border-left: 4px solid #b91c1c; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Email utilisé :</strong> ${email}</p>
                    <p style="margin: 8px 0 0;"><strong>Adresse IP :</strong> ${maskedIp}</p>
                    <p style="margin: 8px 0 0;"><strong>User Agent :</strong> ${userAgent}</p>
                    <p style="margin: 8px 0 0;"><strong>Date :</strong> ${formattedDate} à ${formattedTime}</p>
                  </div>

                  <p>Cet email <strong>n'appartient à aucun utilisateur enregistré</strong> dans SuperTools. Cela peut indiquer :</p>
                  <ul>
                    <li>Une tentative d'intrusion par un tiers</li>
                    <li>Un utilisateur qui utilise un mauvais email</li>
                  </ul>

                  <p>Si les tentatives persistent depuis la même IP, pensez à bloquer cette adresse.</p>

                  <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Cet email a été envoyé automatiquement par le système de sécurité SuperTools.<br>
                    L'adresse IP a été partiellement masquée pour votre sécurité.<br>
                    Les alertes pour un même email inconnu sont limitées à une par heure.
                  </p>

                  <p style="margin-top: 40px;">--<br>
                  <strong>SuperTools</strong><br>
                  Supertilt</p>
                </div>
              `,
              _emailType: "security_alert_unauthorized",
            });

            console.log("Unauthorized access alert email sent successfully");
          } catch (emailError) {
            console.error("Failed to send unauthorized access alert email:", emailError);
          }
        }
      }

      // Compter les échecs récents pour cet email (alerte brute force existante)
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
      const { data: recentFailures, error: countError } = await supabase
        .from("login_attempts")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("success", false)
        .gte("attempted_at", windowStart);

      if (countError) {
        console.error("Error counting failures:", countError);
      }

      const failureCount = recentFailures?.length || 0;

      // Envoyer une alerte si le seuil est atteint
      if (failureCount === ALERT_THRESHOLD) {
        console.log(`Security alert threshold reached for ${email}, sending alert...`);
        
        try {
          const now = new Date();
          const formattedDate = now.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const formattedTime = now.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          // Masquer partiellement l'IP pour la sécurité
          const maskedIp = ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");

          await sendEmail({
            from: senderFrom,
            to: [ADMIN_EMAIL],
            subject: "⚠️ Alerte sécurité SuperTools - Tentatives de connexion suspectes",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h1 style="color: #dc2626;">⚠️ Alerte Sécurité</h1>
                <p><strong>${ALERT_THRESHOLD} tentatives de connexion échouées détectées</strong></p>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Email ciblé :</strong> ${email}</p>
                  <p style="margin: 8px 0 0;"><strong>Adresse IP :</strong> ${maskedIp}</p>
                  <p style="margin: 8px 0 0;"><strong>Date :</strong> ${formattedDate} à ${formattedTime}</p>
                </div>
                
                <p>Si ce n'était pas vous, nous vous recommandons de :</p>
                <ul>
                  <li>Changer votre mot de passe immédiatement</li>
                  <li>Vérifier qu'aucune activité suspecte n'a eu lieu sur votre compte</li>
                </ul>
                
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Cet email a été envoyé automatiquement par le système de sécurité SuperTools.<br>
                  L'adresse IP a été partiellement masquée pour votre sécurité.
                </p>
                
                <p style="margin-top: 40px;">--<br>
                <strong>SuperTools</strong><br>
                Supertilt</p>
              </div>
            `,
            _emailType: "security_alert_bruteforce",
          });
          
          console.log("Security alert email sent successfully");
        } catch (emailError) {
          console.error("Failed to send security alert email:", emailError);
        }
      }
    }

    // Si connexion réussie, nettoyer les anciennes tentatives (> 30 jours)
    if (success) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error: deleteError } = await supabase
        .from("login_attempts")
        .delete()
        .lt("attempted_at", thirtyDaysAgo);

      if (deleteError) {
        console.error("Error cleaning old attempts:", deleteError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Log login attempt error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur lors de l'enregistrement" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // 200 pour ne pas bloquer le frontend
      }
    );
  }
});
