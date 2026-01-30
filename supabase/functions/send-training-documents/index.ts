import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature for romain@supertilt.fr
async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");
  
  if (!signiticApiKey) {
    console.warn("SIGNITIC_API_KEY not configured, using default signature");
    return getDefaultSignature();
  }

  try {
    const response = await fetch(
      "https://api.signitic.app/signatures/romain@supertilt.fr/html",
      {
        headers: {
          "x-api-key": signiticApiKey,
        },
      }
    );

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && !htmlContent.includes("error")) {
        console.log("Signitic signature fetched successfully");
        return htmlContent;
      }
    }
    
    console.warn("Could not fetch Signitic signature:", response.status);
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}

function getDefaultSignature(): string {
  return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
    <strong>Romain Arnoux</strong><br/>
    Supertilt - Formation professionnelle<br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
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

    const firstName = recipientName ? recipientName.split(" ")[0] : null;
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    if (documentType === "invoice" && invoiceUrl) {
      subject = "Votre facture de formation - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>J'espère que vous allez bien !</p>
        <p>Veuillez trouver ci-joint la facture correspondant à notre récente formation. Je reste à votre disposition si vous avez la moindre question.</p>
        <p>Merci encore pour votre confiance, c'est toujours un plaisir de collaborer avec vous !</p>
        <p>Belle journée,</p>
        ${signature}
      `;
      attachments.push({
        filename: "Facture.pdf",
        path: invoiceUrl,
      });
    } else if (documentType === "sheets" && attendanceSheetsUrls?.length > 0) {
      const sheetsCount = attendanceSheetsUrls.length;
      const sheetsText = sheetsCount > 1 ? "les feuilles d'émargement" : "la feuille d'émargement";
      
      subject = "Feuilles d'émargement - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>J'espère que vous allez bien !</p>
        <p>Comme convenu, je vous transmets ${sheetsText} de notre formation. Vous trouverez ${sheetsCount > 1 ? "les documents" : "le document"} en pièce jointe.</p>
        <p>N'hésitez pas à me faire signe si vous avez besoin de quoi que ce soit d'autre.</p>
        <p>À très bientôt,</p>
        ${signature}
      `;
      attendanceSheetsUrls.forEach((url: string, index: number) => {
        // Detect file extension from URL
        const extension = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif|webp)$/)?.[1] || "pdf";
        attachments.push({
          filename: `Feuille_emargement_${index + 1}.${extension}`,
          path: url,
        });
      });
    } else if (documentType === "all") {
      const sheetsCount = attendanceSheetsUrls?.length || 0;
      
      subject = "Documents de formation - Supertilt";
      htmlContent = `
        <p>${greeting}</p>
        <p>J'espère que vous allez bien !</p>
        <p>Veuillez trouver ci-joint les documents relatifs à notre formation :</p>
        <ul style="margin: 10px 0;">
          ${invoiceUrl ? "<li>La facture</li>" : ""}
          ${sheetsCount > 0 ? `<li>${sheetsCount > 1 ? "Les feuilles d'émargement" : "La feuille d'émargement"}</li>` : ""}
        </ul>
        <p>Je reste disponible si vous avez des questions ou besoin d'informations complémentaires.</p>
        <p>Merci encore pour cette belle collaboration !</p>
        <p>À très bientôt,</p>
        ${signature}
      `;
      if (invoiceUrl) {
        attachments.push({
          filename: "Facture.pdf",
          path: invoiceUrl,
        });
      }
      attendanceSheetsUrls?.forEach((url: string, index: number) => {
        const extension = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif|webp)$/)?.[1] || "pdf";
        attachments.push({
          filename: `Feuille_emargement_${index + 1}.${extension}`,
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
        bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
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
