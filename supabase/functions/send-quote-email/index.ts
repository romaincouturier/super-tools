import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId, to, subject, body, isTest } = await req.json();

    if (!to || !subject || !body) {
      throw new Error("Missing required fields: to, subject, body");
    }

    // Fetch Signitic signature using shared helper (with API key + fallback)
    const signature = await getSigniticSignature();

    // Build HTML email
    const htmlBody = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
${htmlBody}
${signature ? `<br>${signature}` : ""}
</body>
</html>`;

    // Generate PDF for attachment if quoteId is provided
    let attachments: { filename: string; content: string }[] = [];
    if (quoteId) {
      try {
        const url = Deno.env.get("SUPABASE_URL")!;
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(url, key);

        // Fetch quote
        const { data: quote } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteId)
          .single();

        // Fetch settings
        const { data: settings } = await supabase
          .from("quote_settings")
          .select("*")
          .limit(1)
          .single();

        if (quote && settings) {
          // Generate a simple HTML-to-PDF approach using PdfMonkey if available
          const pdfMonkeyKey = Deno.env.get("PDFMONKEY_API_KEY");
          
          if (!pdfMonkeyKey) {
            // Generate a clean HTML representation as attachment
            const pdfHtml = generateQuoteHtml(quote, settings);
            const base64 = btoa(unescape(encodeURIComponent(pdfHtml)));
            attachments.push({
              filename: `${quote.quote_number}.html`,
              content: base64,
            });
          } else {
            // Use PdfMonkey for real PDF
            const lineItems = (quote.line_items as any[]) || [];
            const formatEur = (n: number) =>
              new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

            const payload = {
              document: {
                document_template_id: Deno.env.get("PDFMONKEY_QUOTE_TEMPLATE_ID") || "",
                status: "pending",
                payload: {
                  quote_number: quote.quote_number,
                  issue_date: quote.issue_date,
                  expiry_date: quote.expiry_date,
                  company_name: settings.company_name || "",
                  company_address: settings.company_address || "",
                  company_zip: settings.company_zip || "",
                  company_city: settings.company_city || "",
                  company_email: settings.company_email || "",
                  company_phone: settings.company_phone || "",
                  siren: settings.siren || "",
                  vat_number: settings.vat_number || "",
                  client_company: quote.client_company,
                  client_address: quote.client_address,
                  client_zip: quote.client_zip,
                  client_city: quote.client_city,
                  client_vat_number: quote.client_vat_number || "",
                  line_items: lineItems.map((l: any) => ({
                    product: l.product,
                    description: l.description,
                    quantity: l.quantity,
                    unit: l.unit,
                    unit_price_ht: formatEur(l.unit_price_ht),
                    vat_rate: l.vat_rate,
                    total_ht: formatEur(l.quantity * l.unit_price_ht),
                  })),
                  total_ht: formatEur(quote.total_ht || 0),
                  total_vat: formatEur(quote.total_vat || 0),
                  total_ttc: formatEur(quote.total_ttc || 0),
                },
              },
            };

            const pmRes = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${pdfMonkeyKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (pmRes.ok) {
              const pmData = await pmRes.json();
              const docId = pmData.document?.id;
              if (docId) {
                // Poll for completion (max 30s)
                let pdfUrl = "";
                for (let i = 0; i < 15; i++) {
                  await new Promise((r) => setTimeout(r, 2000));
                  const checkRes = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${docId}`, {
                    headers: { Authorization: `Bearer ${pdfMonkeyKey}` },
                  });
                  const checkData = await checkRes.json();
                  if (checkData.document?.status === "success") {
                    pdfUrl = checkData.document.download_url;
                    break;
                  }
                  if (checkData.document?.status === "failure") break;
                }
                if (pdfUrl) {
                  // Download PDF and convert to base64
                  const pdfRes = await fetch(pdfUrl);
                  if (pdfRes.ok) {
                    const pdfBuffer = await pdfRes.arrayBuffer();
                    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
                    attachments.push({
                      filename: `${quote.quote_number}.pdf`,
                      content: base64Pdf,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (pdfErr) {
        console.warn("Could not generate PDF attachment:", pdfErr);
        // Continue without attachment
      }
    }

    // Upload attachments to Supabase Storage for later download
    const storagePaths: string[] = [];
    if (attachments.length > 0 && quoteId) {
      try {
        const url = Deno.env.get("SUPABASE_URL")!;
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(url, key);
        for (const att of attachments) {
          const bytes = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));
          const storagePath = `emails/${quoteId}/${Date.now()}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: uploadError } = await sb.storage
            .from("crm-attachments")
            .upload(storagePath, bytes, { contentType: "application/octet-stream", upsert: false });
          if (!uploadError) {
            storagePaths.push(storagePath);
          } else {
            console.warn("Attachment upload failed:", uploadError);
          }
        }
      } catch (storageErr) {
        console.warn("Storage upload failed (non-blocking):", storageErr);
      }
    }

    const bcc = isTest ? [] : await getBccList();

    const result = await sendEmail({
      to,
      subject,
      html,
      bcc: bcc.length > 0 ? bcc : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      _emailType: "quote_send",
    });

    if (!result.success) {
      throw new Error(result.error || "Email sending failed");
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id, attachment_paths: storagePaths }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-quote-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateQuoteHtml(quote: any, settings: any): string {
  const lineItems = (quote.line_items as any[]) || [];
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const rows = lineItems.map((l: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${l.product || ""}<br><small style="color:#666">${l.description || ""}</small></td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${l.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${l.unit || ""}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(l.unit_price_ht)} €</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(l.quantity * l.unit_price_ht)} €</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12px;color:#333;margin:40px;}</style></head><body>
<h2>${settings.company_name || "SuperTilt"}</h2>
<p>${settings.company_address || ""}, ${settings.company_zip || ""} ${settings.company_city || ""}</p>
<hr>
<h1>Devis ${quote.quote_number}</h1>
<p>Date : ${quote.issue_date} — Validité : ${quote.expiry_date}</p>
<h3>Client</h3>
<p>${quote.client_company}<br>${quote.client_address}<br>${quote.client_zip} ${quote.client_city}</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<thead><tr style="background:#f5f5f5;">
<th style="padding:8px;text-align:left;">Désignation</th>
<th style="padding:8px;text-align:center;">Qté</th>
<th style="padding:8px;text-align:center;">Unité</th>
<th style="padding:8px;text-align:right;">PU HT</th>
<th style="padding:8px;text-align:right;">Total HT</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<table style="margin-left:auto;"><tbody>
<tr><td style="padding:4px 16px;">Total HT</td><td style="padding:4px 16px;text-align:right;font-weight:bold;">${fmt(quote.total_ht || 0)} €</td></tr>
<tr><td style="padding:4px 16px;">TVA</td><td style="padding:4px 16px;text-align:right;">${fmt(quote.total_vat || 0)} €</td></tr>
<tr style="font-size:14px;font-weight:bold;"><td style="padding:8px 16px;border-top:2px solid #333;">Total TTC</td><td style="padding:8px 16px;border-top:2px solid #333;text-align:right;">${fmt(quote.total_ttc || 0)} €</td></tr>
</tbody></table>
<p style="margin-top:30px;font-size:10px;color:#888;">
${settings.payment_terms_text ? `Conditions : ${settings.payment_terms_text}` : ""}
${settings.late_penalty_text ? `<br>Pénalités : ${settings.late_penalty_text}` : ""}
${settings.training_declaration_number ? `<br>N° activité : ${settings.training_declaration_number}` : ""}
</p></body></html>`;
}