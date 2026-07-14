import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { emailButton } from "../_shared/templates.ts";
import { hashArrayBuffer } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");

interface RequestBody {
  orderItemId: string;
  enableOnlineSignature?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { orderItemId, enableOnlineSignature = true } = body;

    if (!orderItemId) {
      return createErrorResponse("orderItemId requis", 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Fetch order item with joins ───────────────────────────────
    const { data: item, error: itemErr } = await supabase
      .from("order_items" as any)
      .select(`
        *,
        woocommerce_orders!woocommerce_order_id (
          wc_order_id, order_number,
          customer_first_name, customer_last_name, customer_email,
          billing_address
        ),
        games!game_id (id, title)
      `)
      .eq("id", orderItemId)
      .single();

    if (itemErr || !item) {
      return createErrorResponse("Commande introuvable", 404);
    }

    const order = (item as any).woocommerce_orders;
    const game = (item as any).games;
    const contractUrl = (item as any).location_contract_file_url;

    if (!contractUrl) {
      return createErrorResponse("Le contrat n'a pas encore été généré. Générez-le d'abord.", 422);
    }

    const billing = (order?.billing_address ?? {}) as Record<string, string>;
    const recipientEmail = order?.customer_email ?? billing.email ?? "";
    const recipientFirstName = billing.first_name ?? order?.customer_first_name ?? "";
    const recipientName =
      [billing.first_name ?? order?.customer_first_name, billing.last_name ?? order?.customer_last_name]
        .filter(Boolean)
        .join(" ") || recipientEmail;
    const gameName = game?.title ?? (item as any).product_name ?? "Jeu";
    const contratReference = (item as any).contrat_reference ?? "";

    if (!recipientEmail) {
      return createErrorResponse("Email du locataire introuvable", 422);
    }

    // ── Download PDF and compute hash ─────────────────────────────
    let currentContractUrl = contractUrl;
    let pdfResponse = await fetch(contractUrl);

    if (!pdfResponse.ok && PDFMONKEY_API_KEY) {
      const docId = (item as any).location_document_id;
      if (docId) {
        const pmRes = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${docId}`, {
          headers: { Authorization: `Bearer ${PDFMONKEY_API_KEY}` },
        });
        if (pmRes.ok) {
          const pmData = await pmRes.json();
          const freshUrl = pmData?.document?.download_url;
          if (freshUrl) {
            pdfResponse = await fetch(freshUrl);
            if (pdfResponse.ok) {
              currentContractUrl = freshUrl;
              await supabase
                .from("order_items" as any)
                .update({ location_contract_file_url: freshUrl })
                .eq("id", orderItemId);
            }
          }
        }
      }
    }

    if (!pdfResponse.ok) {
      throw new Error(`Impossible de télécharger le contrat: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfHashHex = await hashArrayBuffer(pdfBuffer);
    const pdfBytes = new Uint8Array(pdfBuffer);

    // ── Upload to Supabase storage ────────────────────────────────
    const fileName = `location-contracts/${orderItemId}/${contratReference || "contrat"}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("training-documents")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

    let permanentUrl = currentContractUrl;
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);
      permanentUrl = publicUrl;
      await supabase
        .from("order_items" as any)
        .update({ location_contract_file_url: permanentUrl })
        .eq("id", orderItemId);
    } else {
      console.warn("Storage upload failed, using PDF Monkey URL:", uploadError);
    }

    // ── Create signature token ────────────────────────────────────
    let signatureUrl = "";
    let signatureToken = "";

    if (enableOnlineSignature) {
      signatureToken = crypto.randomUUID();
      const urls = await getAppUrls();
      const appUrl = (urls.app_url || "https://super-tools.lovable.app").replace(/\/+$/, "");
      signatureUrl = `${appUrl}/signature-location/${signatureToken}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: insertError } = await supabase
        .from("location_contract_signatures" as any)
        .insert({
          token: signatureToken,
          order_item_id: orderItemId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          game_name: gameName,
          contrat_reference: contratReference,
          pdf_url: permanentUrl,
          pdf_hash: pdfHashHex,
          status: "pending",
          email_sent_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error creating location signature record:", insertError);
        throw new Error("Impossible de créer le lien de signature");
      }
    }

    // ── Fetch email template ──────────────────────────────────────
    const { data: template } = await supabase
      .from("email_templates" as any)
      .select("subject, html_content")
      .eq("template_type", "location_contract")
      .eq("is_default", true)
      .maybeSingle();

    let subject = (template as any)?.subject ?? `Contrat de location — ${gameName}`;
    let htmlBody = (template as any)?.html_content ?? `<p>Bonjour ${recipientFirstName},</p><p>Veuillez trouver ci-joint votre contrat de location pour <strong>${gameName}</strong>.</p>`;

    // Replace template variables
    const replacements: Record<string, string> = {
      "{{prenom_locataire}}": recipientFirstName,
      "{{nom_locataire}}": recipientName,
      "{{jeu_nom}}": gameName,
      "{{contrat_reference}}": contratReference,
      "{{signature_link}}": signatureUrl,
    };
    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replaceAll(key, value);
      htmlBody = htmlBody.replaceAll(key, value);
    }

    // Handle conditional signature block
    if (enableOnlineSignature && signatureUrl) {
      const sigRegex = /\{\{#signature_link\}\}([\s\S]*?)\{\{\/signature_link\}\}/g;
      if (sigRegex.test(htmlBody)) {
        htmlBody = htmlBody.replace(sigRegex, "$1");
      } else {
        htmlBody += emailButton("✍️ Signer le contrat en ligne", signatureUrl);
      }
    } else {
      htmlBody = htmlBody.replace(/\{\{#signature_link\}\}[\s\S]*?\{\{\/signature_link\}\}/g, "");
    }

    const [signatureBlock, bccList] = await Promise.all([
      getSigniticSignature(),
      getBccSettings(supabase as any),
    ]);

    const fullHtml = `${htmlBody}${signatureBlock}`;

    // ── Send email with PDF attachment ────────────────────────────
    const sendResult = await sendEmail({
      to: recipientEmail,
      subject,
      html: fullHtml,
      bcc: bccList,
      attachments: [
        {
          filename: `${contratReference || "contrat-location"}.pdf`,
          content: Array.from(pdfBytes),
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });

    if (!sendResult.success) {
      throw new Error(`Erreur envoi email: ${sendResult.error}`);
    }

    console.log("Location contract email sent to:", recipientEmail);

    return new Response(
      JSON.stringify({ success: true, signatureUrl, signatureToken }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, { cause: error, fn: "send-location-contract-email" });
  }
});
