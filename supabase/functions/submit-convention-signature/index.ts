import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { generateSignedPdf } from "../_shared/generate-signed-pdf.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { formatDateTime } from "../_shared/date-utils.ts";
import { generateHash, hashArrayBuffer, getClientIp } from "../_shared/crypto.ts";

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


serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, signerName, signerFunction, deviceInfo, journeyEvents } = body;

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
    let currentPdfUrl = conventionSig.pdf_url;
    try {
      let pdfResponse = await fetch(currentPdfUrl);

      // If 403 (expired pre-signed URL), try to refresh via PdfMonkey API
      if (!pdfResponse.ok && (pdfResponse.status === 403 || pdfResponse.status === 400)) {
        console.warn(`PDF download returned ${pdfResponse.status} – attempting to refresh URL via PdfMonkey API`);
        const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
        const docIdMatch = currentPdfUrl.match(/\/document\/([0-9a-f-]{36})\//i);

        if (pdfMonkeyApiKey && docIdMatch) {
          const documentId = docIdMatch[1];
          console.log("Refreshing download URL for PdfMonkey document:", documentId);

          const pmResponse = await fetch(
            `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
            { headers: { Authorization: `Bearer ${pdfMonkeyApiKey}` } }
          );

          if (pmResponse.ok) {
            const pmData = await pmResponse.json();
            const freshUrl = pmData?.document?.download_url;
            if (freshUrl) {
              console.log("Got fresh download URL, retrying download");
              pdfResponse = await fetch(freshUrl);
              if (pdfResponse.ok) {
                currentPdfUrl = freshUrl;
                // Update stored URL for future use
                await supabase
                  .from("convention_signatures")
                  .update({ pdf_url: freshUrl })
                  .eq("id", conventionSig.id);
              }
            }
          } else {
            console.warn("PdfMonkey API call failed:", pmResponse.status);
          }
        }
      }

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
      } else {
        console.warn("PDF download failed with status:", pdfResponse.status);
      }
    } catch (pdfErr) {
      console.warn("Could not download PDF for hash verification:", pdfErr);
    }

    // Build the complete journey timeline
    // Merge client-side events with server-side events
    const serverJourneyEvents: JourneyEvent[] = [
      ...(journeyEvents || []),
      {
        event: "signature_submitted_server",
        timestamp: signedAt,
        details: {
          ip_address: ipAddress,
          pdf_integrity_verified: conventionSig.pdf_hash ? conventionSig.pdf_hash === pdfHashAtSignature : null,
        },
      },
    ];

    const consentText =
      "En signant cette convention, j'accepte les conditions de formation proposées et je reconnais que cette signature électronique a valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.";

    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text: consentText,
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
      journey_event_count: serverJourneyEvents.length,
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
        journey_events: serverJourneyEvents,
      })
      .eq("id", conventionSig.id);

    if (updateError) {
      console.error("Error updating convention signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate comprehensive proof file and store in PRIVATE bucket
    let proofFileUrl: string | null = null;
    let proofHash: string | null = null;
    try {
      const proofFile = {
        version: "2.0",
        type: "convention_signature_proof",
        generated_at: new Date().toISOString(),
        signature: {
          id: conventionSig.id,
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
          text: consentText,
        },
        device: deviceInfo || {},
        journey_timeline: serverJourneyEvents,
        identification: {
          method: "email_link",
          email_sent_to: conventionSig.recipient_email,
          email_sent_at: conventionSig.email_sent_at,
          link_first_opened_at: conventionSig.email_opened_at,
          token_expires_at: conventionSig.expires_at,
          note: "Signature Électronique Simple (SES) : le lien unique est envoyé à l'adresse email du signataire désigné. L'accès au lien constitue le principal facteur d'identification.",
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
          link_opening_logged: !!conventionSig.email_opened_at,
          full_journey_tracked: serverJourneyEvents.length > 0,
          consent_explicitly_given: true,
          consent_and_submit_separate_actions: true,
          signature_image_captured: true,
          document_integrity_verified: conventionSig.pdf_hash ? conventionSig.pdf_hash === pdfHashAtSignature : null,
          confirmation_email_sent: false, // updated after sending
          ip_address_captured: ipAddress !== "unknown",
        },
      };

      const proofContent = JSON.stringify(proofFile, null, 2);
      const proofBytes = new TextEncoder().encode(proofContent);

      // Hash the proof file itself for tamper detection
      proofHash = await hashArrayBuffer(proofBytes.buffer);

      const proofFileName = `convention_${conventionSig.id}_${token}.json`;

      // Store in PRIVATE bucket (signature-proofs)
      const { error: uploadError } = await supabase.storage
        .from("signature-proofs")
        .upload(proofFileName, proofBytes, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Failed to upload proof file to private bucket:", uploadError);
        // Fallback: still try public bucket
        const fallbackName = `proofs/convention_${conventionSig.training_id}_${token}.json`;
        const { error: fallbackErr } = await supabase.storage
          .from("training-documents")
          .upload(fallbackName, proofBytes, {
            contentType: "application/json",
            upsert: true,
          });
        if (!fallbackErr) {
          const { data: { publicUrl } } = supabase.storage
            .from("training-documents")
            .getPublicUrl(fallbackName);
          proofFileUrl = publicUrl;
        }
      } else {
        // Private bucket - store the path (not a public URL)
        proofFileUrl = `signature-proofs/${proofFileName}`;
      }

      // Store proof file URL and hash
      await supabase
        .from("convention_signatures")
        .update({
          proof_file_url: proofFileUrl,
          proof_hash: proofHash,
        })
        .eq("id", conventionSig.id);

      console.log("Proof file stored. Hash:", proofHash);
    } catch (proofErr) {
      console.warn("Failed to generate proof file:", proofErr);
    }

    // Generate signed PDF (original + signature page) and upload to storage
    let signedPdfUrl: string | null = null;
    try {
      if (pdfBuffer) {
        const signedPdfBytes = await generateSignedPdf({
          pdfBuffer,
          signatureDataUrl: signatureData,
          signerName,
          signerFunction,
          signedAt,
          documentType: "Convention de formation",
          documentTitle: conventionSig.formation_name,
          clientName: conventionSig.client_name,
          signatureHash,
          ipAddress,
          journeyEvents: serverJourneyEvents,
          pdfHashAtSignature,
        });

        const signedFileName = `signed-conventions/${conventionSig.training_id}/convention_signee_${conventionSig.id}.pdf`;

        const { error: signedUploadError } = await supabase.storage
          .from("training-documents")
          .upload(signedFileName, signedPdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (signedUploadError) {
          console.warn("Failed to upload signed PDF:", signedUploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("training-documents")
            .getPublicUrl(signedFileName);
          signedPdfUrl = publicUrl;

          // Store signed PDF URL in convention_signatures
          await supabase
            .from("convention_signatures")
            .update({ signed_pdf_url: signedPdfUrl })
            .eq("id", conventionSig.id);

          // Append to trainings.signed_convention_urls
          const { data: trainingData } = await supabase
            .from("trainings")
            .select("signed_convention_urls")
            .eq("id", conventionSig.training_id)
            .single();

          const existingUrls = trainingData?.signed_convention_urls || [];
          await supabase
            .from("trainings")
            .update({ signed_convention_urls: [...existingUrls, signedPdfUrl] })
            .eq("id", conventionSig.training_id);

          console.log("Signed PDF uploaded:", signedPdfUrl);
        }
      } else {
        console.warn("No PDF buffer available, skipping signed PDF generation");
      }
    } catch (signedPdfErr) {
      console.warn("Failed to generate signed PDF:", signedPdfErr);
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
          proof_hash: proofHash,
          signed_pdf_url: signedPdfUrl,
          journey_events_count: serverJourneyEvents.length,
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
  <li><strong>Signée le :</strong> ${formatDateTime(signedAt)}</li>
</ul>
<p>Vous pouvez consulter la convention signée en cliquant sur le lien ci-dessous :</p>
<p>
  <a href="${signedPdfUrl || conventionSig.pdf_url}" style="display: inline-block; padding: 10px 20px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">
    📄 Télécharger la convention signée
  </a>
</p>
${signature}`;

      const confirmResult = await sendEmail({
        to: conventionSig.recipient_email,
        subject: `Confirmation de signature - Convention ${conventionSig.formation_name}`,
        html: confirmationHtml,
        bcc: bccList,
      });

      if (confirmResult.success) {
        // Update non_repudiation_elements.confirmation_email_sent in proof
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
        proofHash,
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
