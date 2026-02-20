import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

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
    colorDepth?: number;
    pixelRatio?: number;
    platform?: string;
    cookiesEnabled?: boolean;
    onLine?: boolean;
  };
  journeyEvents?: JourneyEvent[];
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
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
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
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, signerName, signerFunction, deviceInfo, journeyEvents } = body;

    if (!token || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: "Token, signature et nom du signataire requis" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature électronique" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token
    const { data: devisSignature, error: fetchError } = await supabase
      .from("devis_signatures")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !devisSignature) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expiré" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Ce devis a déjà été signé" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (
      devisSignature.status === "expired" ||
      (devisSignature.expires_at && new Date(devisSignature.expires_at) < new Date())
    ) {
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expiré" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Ce devis a été annulé" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    // Download the PDF and compute its hash for integrity verification
    let pdfHashAtSignature: string | null = null;
    try {
      const pdfResponse = await fetch(devisSignature.pdf_url);
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        pdfHashAtSignature = await hashArrayBuffer(pdfBuffer);
      }
    } catch (pdfErr) {
      console.warn("Could not download PDF for hash verification:", pdfErr);
    }

    // Build the complete journey timeline
    const serverJourneyEvents: JourneyEvent[] = [
      ...(journeyEvents || []),
      {
        event: "signature_submitted_server",
        timestamp: signedAt,
        details: {
          ip_address: ipAddress,
          pdf_hash_computed: !!pdfHashAtSignature,
        },
      },
    ];

    const consentText =
      "En signant ce devis, j'accepte les conditions proposées et je reconnais que cette signature électronique a valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.";

    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text: consentText,
      signer_name: signerName,
      signer_function: signerFunction || null,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      pdf_hash_at_signature: pdfHashAtSignature,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      signature_level: "SES (Simple Electronic Signature)",
      document_type: "devis",
      document_details: {
        formation_name: devisSignature.formation_name,
        client_name: devisSignature.client_name,
        devis_type: devisSignature.devis_type,
        pdf_url: devisSignature.pdf_url,
      },
      journey_event_count: serverJourneyEvents.length,
    };

    // Update signature record
    const { error: updateError } = await supabase
      .from("devis_signatures")
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        status: "signed",
        journey_events: serverJourneyEvents,
      })
      .eq("id", devisSignature.id);

    if (updateError) {
      console.error("Error updating signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Generate comprehensive proof file and store in PRIVATE bucket
    let proofFileUrl: string | null = null;
    let proofHash: string | null = null;
    try {
      const proofFile = {
        version: "2.0",
        type: "devis_signature_proof",
        generated_at: new Date().toISOString(),
        signature: {
          id: devisSignature.id,
          token: token,
          signed_at: signedAt,
          signer_name: signerName,
          signer_function: signerFunction || null,
          ip_address: ipAddress,
          user_agent: userAgent,
          signature_image_hash: signatureHash,
        },
        document: {
          type: "devis",
          formation_name: devisSignature.formation_name,
          client_name: devisSignature.client_name,
          devis_type: devisSignature.devis_type,
          pdf_url: devisSignature.pdf_url,
          pdf_hash_at_signature: pdfHashAtSignature,
        },
        consent: {
          given: true,
          timestamp: signedAt,
          text: consentText,
        },
        device: deviceInfo || {},
        journey_timeline: serverJourneyEvents,
        identification: {
          method: "email_link",
          email_sent_to: devisSignature.recipient_email,
          email_sent_at: devisSignature.email_sent_at,
          link_first_opened_at: devisSignature.email_opened_at,
          token_expires_at: devisSignature.expires_at,
          note: "Signature Électronique Simple (SES) : le lien unique est envoyé à l'adresse email du signataire désigné.",
        },
        legal: {
          regulation: "Règlement eIDAS (UE n° 910/2014)",
          civil_code: "Code Civil français, articles 1366 et 1367",
          signature_level: "SES (Signature Électronique Simple)",
          probative_value: "La charge de la preuve de l'authenticité incombe à l'émetteur en cas de contestation.",
          retention_period: "5 ans minimum après fin de relation contractuelle",
          data_protection: "Les données personnelles sont traitées conformément au RGPD (UE 2016/679).",
        },
        non_repudiation_elements: {
          email_dispatch_logged: true,
          link_opening_logged: !!devisSignature.email_opened_at,
          full_journey_tracked: serverJourneyEvents.length > 0,
          consent_explicitly_given: true,
          consent_and_submit_separate_actions: true,
          signature_image_captured: true,
          document_hash_computed: !!pdfHashAtSignature,
          ip_address_captured: ipAddress !== "unknown",
        },
      };

      const proofContent = JSON.stringify(proofFile, null, 2);
      const proofBytes = new TextEncoder().encode(proofContent);
      proofHash = await hashArrayBuffer(proofBytes.buffer);

      const proofFileName = `devis_${devisSignature.id}_${token}.json`;

      const { error: uploadError } = await supabase.storage
        .from("signature-proofs")
        .upload(proofFileName, proofBytes, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Failed to upload proof file:", uploadError);
      } else {
        proofFileUrl = `signature-proofs/${proofFileName}`;
      }

      // Store proof file URL and hash
      await supabase
        .from("devis_signatures")
        .update({
          proof_file_url: proofFileUrl,
          proof_hash: proofHash,
        })
        .eq("id", devisSignature.id);

      console.log("Devis proof file stored. Hash:", proofHash);
    } catch (proofErr) {
      console.warn("Failed to generate proof file:", proofErr);
    }

    // Log the signature event
    try {
      await supabase.from("activity_logs").insert({
        action_type: "devis_signature_submitted",
        recipient_email: devisSignature.recipient_email,
        details: {
          formation_name: devisSignature.formation_name,
          client_name: devisSignature.client_name,
          signer_name: signerName,
          signer_function: signerFunction,
          devis_type: devisSignature.devis_type,
          ip_address: ipAddress,
          signature_hash: signatureHash,
          pdf_hash_at_signature: pdfHashAtSignature,
          proof_file_url: proofFileUrl,
          proof_hash: proofHash,
          journey_events_count: serverJourneyEvents.length,
        },
      });
    } catch (logError) {
      console.warn("Failed to log signature activity:", logError);
    }

    // Send confirmation email
    try {
      const devisTypeLabel = devisSignature.devis_type === "avec_subrogation"
        ? "avec subrogation de paiement"
        : "sans subrogation de paiement";

      const [emailSig, bccList] = await Promise.all([
        getSigniticSignature(),
        getBccSettings(supabase),
      ]);

      const confirmationHtml = `
<p>Bonjour ${signerName},</p>
<p>Nous confirmons la bonne réception de votre signature électronique pour le devis suivant :</p>
<ul>
  <li><strong>Formation :</strong> ${devisSignature.formation_name}</li>
  <li><strong>Client :</strong> ${devisSignature.client_name}</li>
  <li><strong>Type de devis :</strong> ${devisTypeLabel}</li>
  <li><strong>Signé le :</strong> ${formatDateFr(signedAt)}</li>
</ul>
<p>Vous pouvez consulter le devis en cliquant sur le lien ci-dessous :</p>
<p>
  <a href="${devisSignature.pdf_url}" style="display: inline-block; padding: 10px 20px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">
    📄 Télécharger le devis
  </a>
</p>
<p style="margin-top: 16px; font-size: 12px; color: #666;">
  <strong>Informations de traçabilité :</strong><br>
  Empreinte de signature : <code>${signatureHash.substring(0, 16)}...</code><br>
  ${pdfHashAtSignature ? `Empreinte du document : <code>${pdfHashAtSignature.substring(0, 16)}...</code><br>` : ""}
  ${proofHash ? `Empreinte du dossier de preuve : <code>${proofHash.substring(0, 16)}...</code><br>` : ""}
  Niveau de signature : SES (Signature Électronique Simple) - eIDAS (UE n° 910/2014)<br>
  Cet email fait office de confirmation de votre engagement électronique.
</p>
${emailSig}`;

      await sendEmail({
        to: devisSignature.recipient_email,
        subject: `Confirmation de signature - Devis "${devisSignature.formation_name}"`,
        html: confirmationHtml,
        bcc: bccList,
      });

      console.log("Devis confirmation email sent to", devisSignature.recipient_email);
    } catch (emailErr) {
      console.warn("Failed to send confirmation email:", emailErr);
    }

    console.log(`Devis signature submitted for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Devis signé avec succès",
        signedAt,
        signatureHash,
        proofHash,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
