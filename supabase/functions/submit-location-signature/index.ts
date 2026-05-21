import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { generateSignedPdf } from "../_shared/generate-signed-pdf.ts";
import { formatDateTime } from "../_shared/date-utils.ts";
import { generateHash, hashArrayBuffer, getClientIp } from "../_shared/crypto.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import {
  type JourneyEvent,
  type DeviceInfo,
  buildJourneyEvents,
  LEGAL_BLOCK,
  storeProofFile,
} from "../_shared/signature-helpers.ts";

interface RequestBody {
  token: string;
  signatureData: string;
  userAgent: string;
  consent: boolean;
  signerName: string;
  signerFunction?: string;
  deviceInfo?: DeviceInfo;
  journeyEvents?: JourneyEvent[];
}

const STATUS_MESSAGES: Record<string, string> = {
  signed: "Ce contrat a déjà été signé",
  expired: "Ce lien de signature a expiré",
  cancelled: "Ce contrat a été annulé",
};

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

    // ── Verify token ──────────────────────────────────────────────
    const { data: sigRecord, error: fetchError } = await supabase
      .from("location_contract_signatures" as any)
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !sigRecord) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rec = sigRecord as any;

    const effectiveStatus: string =
      rec.status !== "expired" && rec.expires_at && new Date(rec.expires_at) < new Date()
        ? "expired"
        : rec.status;

    if (effectiveStatus !== "pending") {
      return new Response(
        JSON.stringify({ error: STATUS_MESSAGES[effectiveStatus] ?? `Statut invalide : ${effectiveStatus}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    // ── Download PDF and verify integrity ─────────────────────────
    let pdfHashAtSignature: string | null = rec.pdf_hash ?? null;
    let pdfBuffer: ArrayBuffer | null = null;
    let currentPdfUrl = rec.pdf_url;

    try {
      let pdfResponse = await fetch(currentPdfUrl);

      if (!pdfResponse.ok && (pdfResponse.status === 403 || pdfResponse.status === 400)) {
        const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
        const docIdMatch = currentPdfUrl.match(/\/document\/([0-9a-f-]{36})\//i);
        if (pdfMonkeyApiKey && docIdMatch) {
          const pmRes = await fetch(
            `https://api.pdfmonkey.io/api/v1/documents/${docIdMatch[1]}`,
            { headers: { Authorization: `Bearer ${pdfMonkeyApiKey}` } }
          );
          if (pmRes.ok) {
            const freshUrl = (await pmRes.json())?.document?.download_url;
            if (freshUrl) {
              pdfResponse = await fetch(freshUrl);
              if (pdfResponse.ok) {
                currentPdfUrl = freshUrl;
                await supabase
                  .from("location_contract_signatures" as any)
                  .update({ pdf_url: freshUrl })
                  .eq("id", rec.id);
              }
            }
          }
        }
      }

      if (pdfResponse.ok) {
        pdfBuffer = await pdfResponse.arrayBuffer();
        pdfHashAtSignature = await hashArrayBuffer(pdfBuffer);

        if (rec.pdf_hash && rec.pdf_hash !== pdfHashAtSignature) {
          return new Response(
            JSON.stringify({ error: "L'intégrité du document ne peut être vérifiée. Le PDF semble avoir été modifié." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (pdfErr) {
      console.warn("Could not download PDF for hash verification:", pdfErr);
    }

    // ── Build audit data ──────────────────────────────────────────
    const serverJourneyEvents = buildJourneyEvents(journeyEvents, signedAt, {
      ip_address: ipAddress,
      pdf_integrity_verified: rec.pdf_hash ? rec.pdf_hash === pdfHashAtSignature : null,
    });

    const consentText =
      "En signant ce contrat de location, j'accepte les conditions générales de location et je reconnais que cette signature électronique a valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.";

    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text: consentText,
      signer_name: signerName,
      signer_function: signerFunction || null,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      pdf_hash_at_creation: rec.pdf_hash || null,
      pdf_hash_at_signature: pdfHashAtSignature,
      pdf_integrity_verified: rec.pdf_hash ? rec.pdf_hash === pdfHashAtSignature : null,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      signature_level: "SES (Simple Electronic Signature)",
      document_type: "contrat_de_location",
      document_details: {
        game_name: rec.game_name,
        contrat_reference: rec.contrat_reference,
        order_item_id: rec.order_item_id,
        pdf_url: rec.pdf_url,
      },
      journey_event_count: serverJourneyEvents.length,
    };

    // ── Update signature record ───────────────────────────────────
    const { error: updateError } = await supabase
      .from("location_contract_signatures" as any)
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        status: "signed",
        journey_events: serverJourneyEvents,
      })
      .eq("id", rec.id);

    if (updateError) {
      console.error("Error updating location signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate and store proof file ─────────────────────────────
    const proofFileContent = {
      version: "2.0",
      type: "location_contract_signature_proof",
      generated_at: new Date().toISOString(),
      signature: {
        id: rec.id,
        token,
        signed_at: signedAt,
        signer_name: signerName,
        signer_function: signerFunction || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        signature_image_hash: signatureHash,
      },
      document: {
        type: "contrat_de_location",
        game_name: rec.game_name,
        contrat_reference: rec.contrat_reference,
        order_item_id: rec.order_item_id,
        pdf_url: rec.pdf_url,
        pdf_hash_at_creation: rec.pdf_hash || null,
        pdf_hash_at_signature: pdfHashAtSignature,
        integrity_verified: rec.pdf_hash ? rec.pdf_hash === pdfHashAtSignature : null,
      },
      consent: { given: true, timestamp: signedAt, text: consentText },
      device: deviceInfo || {},
      journey_timeline: serverJourneyEvents,
      identification: {
        method: "email_link",
        email_sent_to: rec.recipient_email,
        email_sent_at: rec.email_sent_at,
        link_first_opened_at: rec.email_opened_at,
        token_expires_at: rec.expires_at,
      },
      legal: LEGAL_BLOCK,
    };

    const { proofFileUrl, proofHash } = await storeProofFile(
      supabase,
      "location_contract_signatures",
      rec.id,
      "location",
      token,
      proofFileContent,
    );

    // ── Generate signed PDF ───────────────────────────────────────
    let signedPdfUrl: string | null = null;
    try {
      if (pdfBuffer) {
        const signedPdfBytes = await generateSignedPdf({
          pdfBuffer,
          signatureDataUrl: signatureData,
          signerName,
          signerFunction,
          signedAt,
          documentType: "Contrat de location",
          documentTitle: `${rec.game_name} — ${rec.contrat_reference}`,
          clientName: signerName,
          signatureHash,
          ipAddress,
          journeyEvents: serverJourneyEvents,
          pdfHashAtSignature,
        });

        const signedFileName = `signed-location-contracts/${rec.order_item_id ?? rec.id}/contrat_signe_${rec.id}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from("training-documents")
          .upload(signedFileName, signedPdfBytes, { contentType: "application/pdf", upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from("training-documents")
            .getPublicUrl(signedFileName);
          signedPdfUrl = publicUrl;

          await supabase
            .from("location_contract_signatures" as any)
            .update({ signed_pdf_url: signedPdfUrl })
            .eq("id", rec.id);
        }
      }
    } catch (signedPdfErr) {
      console.warn("Failed to generate signed PDF:", signedPdfErr);
    }

    // ── Update proof file record ──────────────────────────────────
    if (proofFileUrl || proofHash) {
      await supabase
        .from("location_contract_signatures" as any)
        .update({ proof_file_url: proofFileUrl, proof_hash: proofHash })
        .eq("id", rec.id);
    }

    // ── Move order to processed ───────────────────────────────────
    if (rec.order_item_id) {
      await supabase
        .from("order_items" as any)
        .update({ kanban_status: "processed" })
        .eq("id", rec.order_item_id);
    }

    // ── Send confirmation email ───────────────────────────────────
    try {
      const [sigBlock, bccList] = await Promise.all([
        getSigniticSignature(),
        getBccSettings(supabase as any),
      ]);

      const confirmHtml = `
<p>Bonjour ${signerName},</p>
<p>Nous confirmons la bonne réception de votre signature électronique pour le contrat de location suivant :</p>
<ul>
  <li><strong>Jeu :</strong> ${rec.game_name}</li>
  <li><strong>Référence :</strong> ${rec.contrat_reference}</li>
  <li><strong>Signé le :</strong> ${formatDateTime(signedAt)}</li>
</ul>
<p>
  <a href="${signedPdfUrl || rec.pdf_url}" style="display:inline-block;padding:10px 20px;background:#e6bc00;color:#000;text-decoration:none;border-radius:6px;font-weight:bold">
    📄 Télécharger le contrat signé
  </a>
</p>
${sigBlock}`;

      const confirmResult = await sendEmail({
        to: rec.recipient_email,
        subject: `Confirmation de signature — Contrat ${rec.contrat_reference}`,
        html: confirmHtml,
        bcc: bccList,
      });

      if (confirmResult.success) {
        await supabase
          .from("location_contract_signatures" as any)
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq("id", rec.id);
      }
    } catch (emailErr) {
      console.warn("Failed to send confirmation email:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, signedAt, signatureHash, proofHash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
