import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  token: string;
  signatureData: string;
  userAgent: string;
  consent: boolean;
  signerName: string;
  signerFunction?: string;
  deviceInfo?: {
    screenWidth?: number;
    screenHeight?: number;
    timezone?: string;
    language?: string;
  };
}

async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, signerName, signerFunction, deviceInfo } = body;

    if (!token || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: "Token, signature et nom du signataire requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature électronique" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token
    const { data: conventionSig, error: fetchError } = await supabase
      .from("convention_signatures")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !conventionSig) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conventionSig.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Cette convention a déjà été signée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      conventionSig.status === "expired" ||
      (conventionSig.expires_at && new Date(conventionSig.expires_at) < new Date())
    ) {
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expiré" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conventionSig.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Cette convention a été annulée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    // Download the PDF and compute its hash for integrity verification
    let pdfHashAtSignature = conventionSig.pdf_hash || null;
    let pdfBuffer: ArrayBuffer | null = null;
    try {
      const pdfResponse = await fetch(conventionSig.pdf_url);
      if (pdfResponse.ok) {
        pdfBuffer = await pdfResponse.arrayBuffer();
        pdfHashAtSignature = await hashArrayBuffer(pdfBuffer);

        // Verify against original hash if available
        if (conventionSig.pdf_hash && conventionSig.pdf_hash !== pdfHashAtSignature) {
          console.error("PDF integrity check failed: hash mismatch");
          return new Response(
            JSON.stringify({ error: "L'intégrité du document ne peut être vérifiée. Le PDF semble avoir été modifié." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (pdfErr) {
      console.warn("Could not download PDF for hash verification:", pdfErr);
    }

    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text:
        "En signant cette convention, j'accepte les conditions de formation proposées et je reconnais que cette signature électronique a valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.",
      signer_name: signerName,
      signer_function: signerFunction || null,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      pdf_hash_at_creation: conventionSig.pdf_hash || null,
      pdf_hash_at_signature: pdfHashAtSignature,
      pdf_integrity_verified: conventionSig.pdf_hash ? conventionSig.pdf_hash === pdfHashAtSignature : null,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      signature_level: "SES (Simple Electronic Signature)",
      document_type: "convention_de_formation",
      document_details: {
        formation_name: conventionSig.formation_name,
        client_name: conventionSig.client_name,
        training_id: conventionSig.training_id,
        pdf_url: conventionSig.pdf_url,
      },
    };

    // Update signature record
    const { error: updateError } = await supabase
      .from("convention_signatures")
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        status: "signed",
      })
      .eq("id", conventionSig.id);

    if (updateError) {
      console.error("Error updating convention signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate and store proof file (JSON)
    let proofFileUrl: string | null = null;
    try {
      const proofFile = {
        version: "1.0",
        type: "convention_signature_proof",
        generated_at: new Date().toISOString(),
        signature: {
          token: token,
          signed_at: signedAt,
          signer_name: signerName,
          signer_function: signerFunction || null,
          ip_address: ipAddress,
          user_agent: userAgent,
          signature_image_hash: signatureHash,
        },
        document: {
          type: "convention_de_formation",
          formation_name: conventionSig.formation_name,
          client_name: conventionSig.client_name,
          training_id: conventionSig.training_id,
          pdf_url: conventionSig.pdf_url,
          pdf_hash_at_creation: conventionSig.pdf_hash || null,
          pdf_hash_at_signature: pdfHashAtSignature,
          integrity_verified: conventionSig.pdf_hash ? conventionSig.pdf_hash === pdfHashAtSignature : null,
        },
        consent: {
          given: true,
          timestamp: signedAt,
          text: auditMetadata.consent_text,
        },
        device: deviceInfo || {},
        legal: {
          regulation: "eIDAS (UE n° 910/2014)",
          civil_code: "Code Civil art. 1366-1367",
          signature_level: "SES (Simple Electronic Signature)",
          retention_period: "5 ans minimum après fin de relation contractuelle",
        },
      };

      const proofFileName = `proofs/convention_${conventionSig.training_id}_${token}.json`;
      const proofContent = new TextEncoder().encode(JSON.stringify(proofFile, null, 2));

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(proofFileName, proofContent, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Failed to upload proof file:", uploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from("training-documents")
          .getPublicUrl(proofFileName);
        proofFileUrl = publicUrl;

        // Store proof file URL
        await supabase
          .from("convention_signatures")
          .update({ proof_file_url: proofFileUrl })
          .eq("id", conventionSig.id);
      }
    } catch (proofErr) {
      console.warn("Failed to generate proof file:", proofErr);
    }

    // Log the signature event
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_signature_submitted",
        recipient_email: conventionSig.recipient_email,
        details: {
          training_id: conventionSig.training_id,
          formation_name: conventionSig.formation_name,
          client_name: conventionSig.client_name,
          signer_name: signerName,
          signer_function: signerFunction,
          ip_address: ipAddress,
          signature_hash: signatureHash,
          pdf_hash_at_signature: pdfHashAtSignature,
          proof_file_url: proofFileUrl,
        },
      });
    } catch (logError) {
      console.warn("Failed to log convention signature activity:", logError);
    }

    // Send confirmation email to signataire
    try {
      const [signature, bccList] = await Promise.all([
        getSigniticSignature(),
        getBccSettings(supabase),
      ]);

      const confirmationHtml = `
<p>Bonjour ${signerName},</p>
<p>Nous confirmons la bonne réception de votre signature électronique pour la convention de formation suivante :</p>
<ul>
  <li><strong>Formation :</strong> ${conventionSig.formation_name}</li>
  <li><strong>Client :</strong> ${conventionSig.client_name}</li>
  <li><strong>Signée le :</strong> ${formatDateFr(signedAt)}</li>
</ul>
<p>Vous pouvez consulter la convention en cliquant sur le lien ci-dessous :</p>
<p>
  <a href="${conventionSig.pdf_url}" style="display: inline-block; padding: 10px 20px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">
    📄 Télécharger la convention
  </a>
</p>
<p style="margin-top: 16px; font-size: 12px; color: #666;">
  <strong>Informations de traçabilité :</strong><br>
  Empreinte de signature : <code>${signatureHash.substring(0, 16)}...</code><br>
  ${pdfHashAtSignature ? `Empreinte du document : <code>${pdfHashAtSignature.substring(0, 16)}...</code><br>` : ""}
  Niveau de signature : SES (Signature Électronique Simple) - eIDAS (UE n° 910/2014)<br>
  Cet email fait office de confirmation de votre engagement électronique.
</p>
${signature}`;

      const confirmResult = await sendEmail({
        to: conventionSig.recipient_email,
        subject: `Confirmation de signature - Convention ${conventionSig.formation_name}`,
        html: confirmationHtml,
        bcc: bccList,
      });

      if (confirmResult.success) {
        await supabase
          .from("convention_signatures")
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq("id", conventionSig.id);
        console.log("Confirmation email sent to", conventionSig.recipient_email);
      } else {
        console.warn("Failed to send confirmation email:", confirmResult.error);
      }
    } catch (emailErr) {
      console.warn("Failed to send confirmation email:", emailErr);
    }

    console.log(`Convention signature submitted for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Convention signée avec succès",
        signedAt,
        signatureHash,
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
