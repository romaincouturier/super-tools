import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Fetch Signitic signature
async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");

  if (!signiticApiKey) {
    return getDefaultSignature();
  }

  try {
    const response = await fetch(
      "https://api.signitic.app/signatures/romain@supertilt.fr/html",
      {
        headers: {
          "x-api-key": signiticApiKey,
        },
      }
    );

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && !htmlContent.includes("error")) {
        return htmlContent;
      }
    }

    return getDefaultSignature();
  } catch (error) {
    console.warn("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}

function getDefaultSignature(): string {
  return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
    <strong>Romain Couturier</strong><br/>
    <a href="https://www.supertilt.fr" style="color: #1a1a2e; text-decoration: underline;">SuperTilt Formation</a><br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const signatureUrl = `https://super-tools.lovable.app/signature-devis/${token}`;

    // Get email signature
    const emailSignature = await getSigniticSignature();

    // Build email content
    const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";
    const devisTypeLabel = devisType === "avec_subrogation"
      ? "avec subrogation de paiement (votre OPCO regle directement)"
      : "sans subrogation de paiement";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>${greeting}</p>

        <p>Suite a votre demande, nous vous invitons a signer electroniquement le devis pour la formation <strong>"${formationName}"</strong> (${clientName}).</p>

        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Formation :</strong> ${formationName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Client :</strong> ${clientName}</p>
          <p style="margin: 0;"><strong>Type de devis :</strong> ${devisTypeLabel}</p>
        </div>

        <p>Pour signer ce devis, veuillez cliquer sur le bouton ci-dessous :</p>

        <p style="margin: 24px 0;">
          <a href="${signatureUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Signer le devis
          </a>
        </p>

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
    const resend = new Resend(resendApiKey);
    const emailResponse = await resend.emails.send({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [recipientEmail],
      bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
      subject: `Signature de devis - Formation "${formationName}"`,
      html: htmlContent,
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
