import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  activityLogId: string; // Reference to the activity_logs entry for the devis
  recipientEmail: string;
  recipientName?: string;
  clientName: string;
  formationName: string;
  devisType: "sans_subrogation" | "avec_subrogation";
  pdfUrl: string;
  expiresInDays?: number; // Default 30 days
}

// Generate a secure token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    console.log("Received request:", JSON.stringify(body));

    const {
      activityLogId,
      recipientEmail,
      recipientName,
      clientName,
      formationName,
      devisType,
      pdfUrl,
      expiresInDays = 30,
    } = body;

    // Validate required fields
    if (!activityLogId || !recipientEmail || !clientName || !formationName || !devisType || !pdfUrl) {
      return new Response(
        JSON.stringify({ error: "Champs obligatoires manquants" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const urls = await getAppUrls();
    const appUrl = urls.app_url;

    // Generate unique token
    const token = generateToken();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create signature request record
    const { data: signatureRecord, error: insertError } = await supabase
      .from("devis_signatures")
      .insert({
        activity_log_id: activityLogId,
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        client_name: clientName,
        formation_name: formationName,
        devis_type: devisType,
        pdf_url: pdfUrl,
        token: token,
        email_sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating signature record:", insertError);
      throw new Error("Erreur lors de la creation de la demande de signature");
    }

    // Build signature URL
    const signatureUrl = `${appUrl}/signature-devis/${token}`;

    // Get email signature
    const emailSignature = await getSigniticSignature();

    // Build email content
    const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";
    const devisTypeLabel = devisType === "avec_subrogation"
      ? "avec subrogation de paiement (votre OPCO regle directement)"
      : "sans subrogation de paiement";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
        <p>${greeting}</p>

        <p>Suite a votre demande, nous vous invitons a signer electroniquement le devis pour la formation <strong>"${formationName}"</strong> (${clientName}).</p>

        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Formation :</strong> ${formationName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Client :</strong> ${clientName}</p>
          <p style="margin: 0;"><strong>Type de devis :</strong> ${devisTypeLabel}</p>
        </div>

        <p>Pour signer ce devis, veuillez cliquer sur le bouton ci-dessous :</p>

        ${emailButton("Signer le devis", signatureUrl)}

        <p style="font-size: 14px; color: #666;">
          Ce lien est valable pendant ${expiresInDays} jours. Vous pouvez egalement consulter le devis PDF avant de le signer.
        </p>

        <p style="font-size: 14px; color: #666; margin-top: 16px;">
          <strong>Note :</strong> Cette signature electronique est juridiquement valide en France conformement au reglement europeen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil.
        </p>

        <p>Nous restons a votre disposition pour toute question.</p>

        ${emailSignature}
      </div>
    `;

    // Send email
    const [senderFrom, bccList] = await Promise.all([getSenderFrom(), getBccList()]);
    const emailResponse = await sendEmail({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject: `Signature de devis - Formation "${formationName}"`,
      html: htmlContent,
      _emailType: "devis_signature_request",
    });

    console.log("Email sent successfully:", emailResponse);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "devis_signature_request_sent",
        recipient_email: recipientEmail,
        details: {
          formation_name: formationName,
          client_name: clientName,
          devis_type: devisType,
          signature_id: signatureRecord.id,
          expires_at: expiresAt.toISOString(),
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demande de signature envoyee",
        signatureId: signatureRecord.id,
        signatureUrl,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
