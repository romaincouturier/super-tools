import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, trainingId, participantId } = await req.json();
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

    // Check participant exists (silent fail for security)
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name")
      .ilike("email", email)
      .limit(1);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un lien vous a été envoyé." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if learner already has a Supabase account (adapts email copy)
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email.toLowerCase());
    const hasAccount = !!existingUser?.user;

    // Fetch training details
    let trainingName: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;
    if (trainingId) {
      const { data: training } = await supabase
        .from("trainings")
        .select("training_name, start_date, end_date")
        .eq("id", trainingId)
        .maybeSingle();
      trainingName = training?.training_name ?? null;
      startDate = training?.start_date ?? null;
      endDate = training?.end_date ?? null;
    }

    // 30-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const insertPayload: Record<string, unknown> = {
      email: email.toLowerCase(),
      expires_at: expiresAt.toISOString(),
    };
    if (trainingId) insertPayload.training_id = trainingId;

    const { data: link, error } = await supabase
      .from("learner_magic_links")
      .insert(insertPayload)
      .select("token")
      .single();

    if (error) throw error;

    const urls = await getAppUrls();
    const appUrl = urls.app_url;

    const onboardingUrl = `${appUrl}/apprenant/connexion?token=${link.token}`;
    const firstName = participants[0].first_name || "Apprenant";

    // Build date label
    let dateLine = "";
    if (startDate && endDate && startDate !== endDate) {
      dateLine = ` qui se déroule du <strong>${formatDateFr(startDate)}</strong> au <strong>${formatDateFr(endDate)}</strong>`;
    } else if (startDate) {
      dateLine = ` le <strong>${formatDateFr(startDate)}</strong>`;
    }

    const formationLabel = trainingName
      ? `"<strong>${trainingName}</strong>"`
      : "votre formation en ligne";

    const subject = trainingName
      ? `Votre accès à la formation ${trainingName}`
      : "Votre accès à votre formation en ligne";

    const intro = hasAccount
      ? `Votre accès à la formation ${formationLabel}${dateLine} a été activé. Cliquez sur le bouton ci-dessous pour accéder à votre espace apprenant :`
      : `Votre entreprise vient de vous inscrire à la formation ${formationLabel}${dateLine}. Cliquez sur le bouton ci-dessous pour créer votre compte et accéder à votre espace apprenant :`;

    await sendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
          <h1 style="color: #101820; font-size: 24px;">Bonjour ${firstName},</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            ${intro}
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${onboardingUrl}" style="background-color: #ffd100; color: #101820; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Accéder à ma formation
            </a>
          </div>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Je vous souhaite une bonne formation et à très bientôt sur SuperTilt.fr
          </p>
          <p style="color: #555; font-size: 15px;">
            Si vous avez le moindre souci, contactez-moi.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 12px; text-align: center;">
            Ce lien est valable 30 jours. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
          </p>
        </div>
      `,
      _emailType: "learner_magic_link",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Lien d'accès envoyé." }),
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
