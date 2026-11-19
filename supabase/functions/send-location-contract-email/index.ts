import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { canAccessOrderItem } from "../_shared/order-item-access.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { emailButton } from "../_shared/templates.ts";
import { hashArrayBuffer } from "../_shared/crypto.ts";
import { isCronOrServiceRole } from "../_shared/cron-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");

interface RequestBody {
  orderItemId: string;
  enableOnlineSignature?: boolean;
  /** Avenant de prolongation à envoyer au lieu du contrat d'origine. */
  extensionId?: string;
  /** Renvoi manuel explicite : réutilise le lien en attente et renvoie l'email. */
  resend?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { orderItemId, enableOnlineSignature = true, extensionId, resend = false } = body;

    if (!orderItemId) {
      return new Response(JSON.stringify({ error: "orderItemId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garde [063] : la RLS du module dropshipping, jouée avec le jeton de l'appelant.
    if (!(await isCronOrServiceRole(req)) && !(await canAccessOrderItem(req, orderItemId))) {
      return createErrorResponse("Accès refusé", 403);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let extension: { id: string; contrat_reference: string; contract_file_url: string | null; contract_document_id: string | null } | null = null;
    if (extensionId) {
      const { data: ext } = await supabase
        .from("location_extensions")
        .select("id, contrat_reference, contract_file_url, contract_document_id")
        .eq("id", extensionId)
        .eq("order_item_id", orderItemId)
        .maybeSingle();
      if (!ext) {
        return createErrorResponse("Prolongation introuvable", 404);
      }
      extension = ext as typeof extension;
    }

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
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const order = (item as any).woocommerce_orders;
    const game = (item as any).games;
    const contractUrl = extension ? extension.contract_file_url : (item as any).location_contract_file_url;
    // L'URL à jour du PDF est rangée là où le document a été généré.
    const contractTable = extension ? "location_extensions" : "order_items";
    const contractRowId = extension ? extension.id : orderItemId;
    const contractUrlColumn = extension ? "contract_file_url" : "location_contract_file_url";

    if (!contractUrl) {
      return new Response(
        JSON.stringify({ error: "Le contrat n'a pas encore été généré. Générez-le d'abord." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const billing = (order?.billing_address ?? {}) as Record<string, string>;
    const recipientEmail = order?.customer_email ?? billing.email ?? "";
    const recipientFirstName = billing.first_name ?? order?.customer_first_name ?? "";
    const recipientName =
      [billing.first_name ?? order?.customer_first_name, billing.last_name ?? order?.customer_last_name]
        .filter(Boolean)
        .join(" ") || recipientEmail;
    const gameName = game?.title ?? (item as any).product_name ?? "Jeu";
    const contratReference = extension ? extension.contrat_reference : (item as any).contrat_reference ?? "";

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Email du locataire introuvable" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Download PDF and compute hash ─────────────────────────────
    let currentContractUrl = contractUrl;
    let pdfResponse = await fetch(contractUrl);

    if (!pdfResponse.ok && PDFMONKEY_API_KEY) {
      const docId = extension ? extension.contract_document_id : (item as any).location_document_id;
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
                .from(contractTable as any)
                .update({ [contractUrlColumn]: freshUrl })
                .eq("id", contractRowId);
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
        .from(contractTable as any)
        .update({ [contractUrlColumn]: permanentUrl })
        .eq("id", contractRowId);
    } else {
      console.warn("Storage upload failed, using PDF Monkey URL:", uploadError);
    }

    // ── Create signature token ────────────────────────────────────
    let signatureUrl = "";
    let signatureToken = "";
    let signatureId: string | null = null;

    if (enableOnlineSignature) {
      const { data: existing, error: existingError } = await supabase.from("location_contract_signatures" as any)
        .select("id, token, status, email_sent_at, expires_at, pdf_hash")
        .eq("order_item_id", orderItemId)
        .or(extension ? `location_extension_id.eq.${extension.id}` : "location_extension_id.is.null")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.status === "signed" || ((!resend && existing?.status === "pending" && existing?.email_sent_at && existing?.pdf_hash === pdfHashHex))) {
        return new Response(JSON.stringify({ success: true, alreadySent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const reusable = existing?.status === "pending" && (resend || !existing.email_sent_at) && existing.pdf_hash === pdfHashHex && new Date(existing.expires_at).getTime() > Date.now();
      signatureToken = reusable ? existing.token : crypto.randomUUID();
      signatureId = reusable ? existing.id : null;
      const urls = await getAppUrls();
      const appUrl = (urls.app_url || "https://academy.supertilt.fr").replace(/\/+$/, "");
      signatureUrl = `${appUrl}/signature-location/${signatureToken}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      if (!reusable) {
      const { data: inserted, error: insertError } = await supabase
        .from("location_contract_signatures" as any)
        .insert({
          token: signatureToken,
          order_item_id: orderItemId,
          location_extension_id: extension?.id ?? null,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          game_name: gameName,
          contrat_reference: contratReference,
          pdf_url: permanentUrl,
          pdf_hash: pdfHashHex,
          status: "pending",
          email_sent_at: null,
          expires_at: expiresAt.toISOString(),
        }).select("id").single();

      if (insertError) {
        console.error("Error creating location signature record:", insertError);
        throw new Error("Impossible de créer le lien de signature");
      }
      signatureId = inserted.id;
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
    if (extension) subject = `Avenant de prolongation ${contratReference} : ${gameName}`;

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
      _emailType: "location_contract",
      idempotencyKey: `location-contract-${signatureId ?? orderItemId}-${pdfHashHex}`,
      attachments: [
        {
          filename: `${contratReference || "contrat-location"}.pdf`,
          content: btoa(Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join("")),
        },
      ],
    });

    const sentAt = new Date().toISOString();
    await supabase.from("order_email_log" as any).insert({ order_item_id: orderItemId, wc_order_id: order?.wc_order_id, template_key: "location_contract", sent_to: [recipientEmail], subject, body: fullHtml, status: sendResult.success ? "sent" : "failed", error: sendResult.error ?? null });
    if (!sendResult.success) {
      throw new Error(`Erreur envoi email: ${sendResult.error}`);
    }

    if (signatureId) {
      const { error: signatureUpdateError } = await supabase.from("location_contract_signatures" as any).update({ email_sent_at: sentAt }).eq("id", signatureId);
      if (signatureUpdateError) throw signatureUpdateError;
    }
    if (!extension) {
      const { error: itemUpdateError } = await supabase.from("order_items" as any).update({ email_sent_at: sentAt, email_sent_to: recipientEmail, kanban_status: "location_pending", block_reason: null }).eq("id", orderItemId);
      if (itemUpdateError) throw itemUpdateError;
    }
    await supabase.from("activity_logs").insert({ action_type: "location_contract_sent", recipient_email: recipientEmail, details: { order_item_id: orderItemId, contrat_reference: contratReference, resend_email_id: sendResult.id, signature_id: signatureId } });

    console.log("Location contract email sent to:", recipientEmail);

    if (extension && enableOnlineSignature) {
      await supabase
        .from("location_extensions")
        .update({ signature_status: "pending", signature_sent_at: new Date().toISOString() })
        .eq("id", extension.id);
    }

    return new Response(
      JSON.stringify({ success: true, signatureUrl, signatureToken }),
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
