import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  trainingId: string;
  conventionUrl: string;
  recipientEmail: string;
  recipientName?: string;
  recipientFirstName?: string;
  formalAddress?: boolean;
  conventionFileName?: string;
  enableOnlineSignature?: boolean;
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const {
      trainingId,
      conventionUrl,
      recipientEmail,
      recipientName,
      recipientFirstName,
      formalAddress = true,
      conventionFileName,
      enableOnlineSignature = false,
    } = body;

    if (!trainingId || !conventionUrl || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "trainingId, conventionUrl et recipientEmail sont requis" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, start_date, end_date, client_name")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return new Response(
        JSON.stringify({ error: "Formation introuvable" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // If online signature is enabled, create a signature token
    let signatureUrl = "";
    let signatureToken = "";
    if (enableOnlineSignature) {
      signatureToken = crypto.randomUUID();

      // Build the public URL for the signature page
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
      signatureUrl = `${origin}/signature-convention/${signatureToken}`;

      // Set expiry to 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: insertError } = await supabase
        .from("convention_signatures")
        .insert({
          token: signatureToken,
          training_id: trainingId,
          recipient_email: recipientEmail,
          recipient_name: recipientName || null,
          client_name: training.client_name || recipientName || "",
          formation_name: training.training_name,
          pdf_url: conventionUrl,
          status: "pending",
          email_sent_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error creating convention signature record:", insertError);
        throw new Error("Impossible de créer le lien de signature");
      }
    }

    // Determine template type based on formal address
    const templateType = formalAddress ? "convention_vous" : "convention_tu";

    // Fetch email template
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", templateType)
      .eq("is_default", true)
      .maybeSingle();

    const startDateFormatted = formatDateFr(training.start_date);
    const endDateFormatted = training.end_date
      ? formatDateFr(training.end_date)
      : startDateFormatted;
    const firstName = recipientFirstName || recipientName || "";

    // Build subject and body from template (or defaults)
    let subject = template?.subject || `Convention de formation - ${training.training_name}`;
    let htmlBody = template?.html_content || `<p>Bonjour,</p><p>Veuillez trouver ci-joint la convention de formation.</p>`;

    // Replace template variables
    const replacements: Record<string, string> = {
      "{{first_name}}": firstName,
      "{{training_name}}": training.training_name,
      "{{start_date}}": startDateFormatted,
      "{{end_date}}": endDateFormatted,
      "{{signature_link}}": signatureUrl,
    };

    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replaceAll(key, value);
      htmlBody = htmlBody.replaceAll(key, value);
    }

    // If online signature is enabled, add the signature button block
    if (enableOnlineSignature && signatureUrl) {
      // Process conditional block {{#signature_link}} ... {{/signature_link}}
      const signatureLinkRegex = /\{\{#signature_link\}\}([\s\S]*?)\{\{\/signature_link\}\}/g;
      if (signatureLinkRegex.test(htmlBody)) {
        htmlBody = htmlBody.replace(signatureLinkRegex, "$1");
      } else {
        // If no conditional block found, append the signature button
        htmlBody += `
<p style="margin-top: 20px;">
  <a href="${signatureUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">
    ✍️ Signer la convention en ligne
  </a>
</p>`;
      }
    } else {
      // Remove conditional signature block if present
      const signatureLinkRegex = /\{\{#signature_link\}\}[\s\S]*?\{\{\/signature_link\}\}/g;
      htmlBody = htmlBody.replace(signatureLinkRegex, "");
    }

    // Get signature and BCC
    const [signature, bccList] = await Promise.all([
      getSigniticSignature(),
      getBccSettings(supabase),
    ]);

    const fullHtml = `${htmlBody}${signature}`;

    // Download the PDF to attach it and compute its hash for integrity
    console.log("Downloading convention PDF from:", conventionUrl);
    let pdfResponse = await fetch(conventionUrl);

    // If 403 (expired pre-signed URL), try to get a fresh URL from PdfMonkey
    if (pdfResponse.status === 403) {
      console.warn("PDF download returned 403 – attempting to refresh URL via PdfMonkey API");
      const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
      // Extract document ID from PdfMonkey S3 URL pattern: .../document/{uuid}/...
      const docIdMatch = conventionUrl.match(/\/document\/([0-9a-f-]{36})\//i);

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

            // Update the stored URL so future calls don't hit the same issue
            if (pdfResponse.ok) {
              try {
                await supabase
                  .from("trainings")
                  .update({ convention_file_url: freshUrl })
                  .eq("id", trainingId);
                console.log("Updated training with fresh convention URL");
              } catch (updateErr) {
                console.warn("Could not update training URL:", updateErr);
              }
            }
          }
        } else {
          console.warn("PdfMonkey API call failed:", pmResponse.status);
        }
      }
    }

    if (!pdfResponse.ok) {
      throw new Error(`Impossible de télécharger la convention: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Compute SHA-256 hash of the PDF for document integrity
    const pdfHashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
    const pdfHashArray = Array.from(new Uint8Array(pdfHashBuffer));
    const pdfHash = pdfHashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    console.log("PDF SHA-256 hash:", pdfHash);

    const fileName = conventionFileName || "Convention_de_formation.pdf";

    // Upload the PDF to permanent storage so the URL never expires
    let permanentPdfUrl = conventionUrl;
    try {
      const storagePath = `conventions/${trainingId}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("training-documents")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage
          .from("training-documents")
          .getPublicUrl(storagePath);
        permanentPdfUrl = publicUrl;
        console.log("PDF uploaded to permanent storage:", permanentPdfUrl);
      } else {
        console.warn("Failed to upload PDF to storage, keeping original URL:", uploadErr);
      }
    } catch (storageErr) {
      console.warn("Storage upload error:", storageErr);
    }

    // Store the PDF hash and permanent URL in the signature record
    if (enableOnlineSignature && signatureToken) {
      await supabase
        .from("convention_signatures")
        .update({ pdf_hash: pdfHash, pdf_url: permanentPdfUrl })
        .eq("token", signatureToken);
    }

    // Convert to base64 in chunks to avoid stack overflow
    const CHUNK_SIZE = 8192;
    let binaryStr = "";
    for (let i = 0; i < pdfBytes.length; i += CHUNK_SIZE) {
      const chunk = pdfBytes.slice(i, i + CHUNK_SIZE);
      binaryStr += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryStr);

    // Send email with attachment
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html: fullHtml,
      bcc: bccList,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi de l'email");
    }

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_email_sent",
        recipient_email: recipientEmail,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          convention_url: conventionUrl,
          recipient_name: recipientName,
          email_id: result.id,
          online_signature_enabled: enableOnlineSignature,
          signature_token: signatureToken || undefined,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    console.log(`Convention email sent to ${recipientEmail}${enableOnlineSignature ? " (with online signature)" : ""}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: result.id,
        signatureUrl: signatureUrl || undefined,
        signatureToken: signatureToken || undefined,
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
