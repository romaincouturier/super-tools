import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature
async function getSigniticSignature(): Promise<string> {
  try {
    const SIGNITIC_API_KEY = Deno.env.get("SIGNITIC_API_KEY");
    if (!SIGNITIC_API_KEY) {
      console.warn("SIGNITIC_API_KEY not configured, using default signature");
      return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
        <strong>Romain Arnoux</strong><br/>
        Supertilt - Formation professionnelle<br/>
        <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
      </p>`;
    }

    const response = await fetch("https://api.signitic.com/v1/signature", {
      headers: {
        "Authorization": `Bearer ${SIGNITIC_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Signitic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.html || "";
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
      <strong>Romain Arnoux</strong><br/>
      Supertilt - Formation professionnelle<br/>
      <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
    </p>`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      trainingId, 
      recipientEmail, 
      recipientName, 
      documentType,
      invoiceUrl,
      attendanceSheetsUrls,
      ccEmail
    } = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Get Signitic signature
    const signature = await getSigniticSignature();

    // Build email content based on document type
    let subject = "";
    let htmlContent = "";
    const attachments: Array<{ filename: string; path: string }> = [];

    const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";

    if (documentType === "invoice" && invoiceUrl) {
      subject = "Votre facture de formation - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>Veuillez trouver ci-joint la facture relative à votre formation.</p>
        <p>N'hésitez pas à nous contacter si vous avez des questions.</p>
        ${signature}
      `;
      attachments.push({
        filename: "Facture.pdf",
        path: invoiceUrl,
      });
    } else if (documentType === "sheets" && attendanceSheetsUrls?.length > 0) {
      subject = "Feuilles d'émargement de formation - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>Veuillez trouver ci-joint ${attendanceSheetsUrls.length > 1 ? "les feuilles d'émargement" : "la feuille d'émargement"} relative${attendanceSheetsUrls.length > 1 ? "s" : ""} à votre formation.</p>
        <p>N'hésitez pas à nous contacter si vous avez des questions.</p>
        ${signature}
      `;
      attendanceSheetsUrls.forEach((url: string, index: number) => {
        attachments.push({
          filename: `Feuille_emargement_${index + 1}.pdf`,
          path: url,
        });
      });
    } else if (documentType === "all") {
      subject = "Documents de formation - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>Veuillez trouver ci-joint les documents relatifs à votre formation :</p>
        <ul>
          ${invoiceUrl ? "<li>Facture</li>" : ""}
          ${attendanceSheetsUrls?.length > 0 ? `<li>${attendanceSheetsUrls.length} feuille(s) d'émargement</li>` : ""}
        </ul>
        <p>N'hésitez pas à nous contacter si vous avez des questions.</p>
        ${signature}
      `;
      if (invoiceUrl) {
        attachments.push({
          filename: "Facture.pdf",
          path: invoiceUrl,
        });
      }
      attendanceSheetsUrls?.forEach((url: string, index: number) => {
        attachments.push({
          filename: `Feuille_emargement_${index + 1}.pdf`,
          path: url,
        });
      });
    } else {
      return new Response(
        JSON.stringify({ error: "No documents to send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending email to:", recipientEmail);
    console.log("CC:", ccEmail || "none");
    console.log("Subject:", subject);
    console.log("Attachments:", attachments.length);

    // Build recipient list
    const toList = [recipientEmail];
    const ccList: string[] = [];
    if (ccEmail) {
      ccList.push(ccEmail);
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Arnoux <romain@supertilt.fr>",
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: ["supertilt@bcc.nocrm.io"],
        subject,
        html: htmlContent,
        attachments,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending documents:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send documents";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
