import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";
import { generateSignedPdf } from "../_shared/generate-signed-pdf.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { formatDateTime } from "../_shared/date-utils.ts";
import { generateHash, hashArrayBuffer, getClientIp } from "../_shared/crypto.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import {
  type JourneyEvent,
  buildJourneyEvents,
  LEGAL_BLOCK,
  storeProofFile,
} from "../_shared/signature-helpers.ts";
import { logEmailActivity } from "../_shared/email-helpers.ts";

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

// Split a full name into first/last. Last word becomes lastName, rest is firstName.
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
}

async function autoAddParticipantFromDevis(
  supabase: ReturnType<typeof import("../_shared/supabase-client.ts").getSupabaseClient>,
  devisSignature: Record<string, unknown>,
  signerName: string,
  signedAt: string,
): Promise<void> {
  const trainingId = devisSignature.training_id as string;

  // Verify training exists and is inter-entreprises
  const { data: training, error: trainingErr } = await supabase
    .from("trainings")
    .select("id, training_name, format_formation")
    .eq("id", trainingId)
    .single();

  if (trainingErr || !training) {
    console.warn("Training not found for auto-add:", trainingId);
    return;
  }

  const fmt = (training.format_formation ?? "").toLowerCase();
  if (!fmt.includes("inter")) {
    console.warn("Training is not inter-entreprises, skipping auto-add:", fmt);
    return;
  }

  const email = (devisSignature.recipient_email as string).trim().toLowerCase();

  // Avoid duplicate: check if participant already exists
  const { data: existing } = await supabase
    .from("training_participants")
    .select("id")
    .eq("training_id", trainingId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    console.log("Participant already exists in training, skipping:", email);
    return;
  }

  const { firstName, lastName } = splitName(
    (devisSignature.recipient_name as string | null) || signerName,
  );

  const needsSurveyToken = crypto.randomUUID();

  const { data: participant, error: participantErr } = await supabase
    .from("training_participants")
    .insert({
      training_id: trainingId,
      first_name: firstName || null,
      last_name: lastName || null,
      email,
      company: (devisSignature.client_name as string | null) || null,
      needs_survey_token: needsSurveyToken,
      needs_survey_status: "non_envoye",
      coaching_sessions_total: 0,
      coaching_sessions_completed: 0,
      payment_mode: "invoice",
      sold_price_ht: (devisSignature.total_amount_ht as number | null) ?? null,
      sponsor_first_name: firstName || null,
      sponsor_last_name: lastName || null,
      sponsor_email: email,
      financeur_same_as_sponsor: true,
    })
    .select("id")
    .single();

  if (participantErr) {
    throw new Error(`Failed to insert participant: ${participantErr.message}`);
  }

  // Create the questionnaire_besoins record
  await supabase.from("questionnaire_besoins").insert({
    training_id: trainingId,
    participant_id: participant.id,
    token: needsSurveyToken,
    etat: "non_envoye",
  });

  // Log activity
  await supabase.from("activity_logs").insert({
    action_type: "participant_added_from_signed_devis",
    recipient_email: email,
    details: {
      training_id: trainingId,
      training_name: training.training_name,
      participant_id: participant.id,
      devis_signature_id: devisSignature.id,
      signed_at: signedAt,
      source: "auto_from_devis_signature",
    },
  });

  console.log(`Auto-added participant ${email} to training ${trainingId}`);
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature électronique" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Verify token
    const { data: devisSignature, error: fetchError } = await supabase
      .from("devis_signatures")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !devisSignature) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Ce devis a déjà été signé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      devisSignature.status === "expired" ||
      (devisSignature.expires_at && new Date(devisSignature.expires_at) < new Date())
    ) {
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expiré" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Ce devis a été annulé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    // Download the PDF and compute its hash for integrity verification
    let pdfHashAtSignature: string | null = null;
    let pdfBuffer: ArrayBuffer | null = null;
    try {
      const pdfResponse = await fetch(devisSignature.pdf_url);
      if (pdfResponse.ok) {
        pdfBuffer = await pdfResponse.arrayBuffer();
        pdfHashAtSignature = await hashArrayBuffer(pdfBuffer);
      }
    } catch (pdfErr) {
      console.warn("Could not download PDF for hash verification:", pdfErr);
    }

    // Build the complete journey timeline
    const serverJourneyEvents = buildJourneyEvents(journeyEvents, signedAt, {
      ip_address: ipAddress,
      pdf_hash_computed: !!pdfHashAtSignature,
    });

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate comprehensive proof file and store in PRIVATE bucket
    const proofFileContent = {
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
      legal: LEGAL_BLOCK,
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

    const { proofFileUrl, proofHash } = await storeProofFile(
      supabase,
      "devis_signatures",
      devisSignature.id,
      "devis",
      token,
      proofFileContent,
    );

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
          documentType: "Devis",
          documentTitle: devisSignature.formation_name,
          clientName: devisSignature.client_name,
          signatureHash,
          ipAddress,
          journeyEvents: serverJourneyEvents,
          pdfHashAtSignature,
        });

        const signedFileName = `signed/${devisSignature.id}.pdf`;
        const { error: signedUploadError } = await supabase.storage
          .from("devis-pdfs")
          .upload(signedFileName, signedPdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (signedUploadError) {
          console.warn("Failed to upload signed devis PDF:", signedUploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("devis-pdfs")
            .getPublicUrl(signedFileName);
          signedPdfUrl = publicUrl;

          await supabase
            .from("devis_signatures")
            .update({ signed_pdf_url: signedPdfUrl } as any)
            .eq("id", devisSignature.id);

          console.log("Signed devis PDF uploaded:", signedPdfUrl);
        }
      } else {
        console.warn("No PDF buffer available, skipping signed devis PDF generation");
      }
    } catch (signedPdfErr) {
      console.warn("Failed to generate signed devis PDF:", signedPdfErr);
    }

    // Log the signature event
    await logEmailActivity(supabase, "devis_signature_submitted", devisSignature.recipient_email, {
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
      signed_pdf_url: signedPdfUrl,
      journey_events_count: serverJourneyEvents.length,
    });

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
  <li><strong>Signé le :</strong> ${formatDateTime(signedAt)}</li>
</ul>
<p>Vous pouvez consulter le devis signé en cliquant sur le lien ci-dessous :</p>
${emailButton("📄 Télécharger le devis signé", signedPdfUrl || devisSignature.pdf_url)}
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

    // Auto-add participant to inter-company training if linked
    if ((devisSignature as any).training_id) {
      try {
        await autoAddParticipantFromDevis(supabase, devisSignature, signerName, signedAt);
      } catch (participantErr) {
        console.warn("Failed to auto-add participant to training:", participantErr);
      }
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
