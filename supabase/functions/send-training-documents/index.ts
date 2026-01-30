import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      attendanceSheetsUrls 
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
        <p>Cordialement,<br/>L'équipe Supertilt</p>
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
        <p>Cordialement,<br/>L'équipe Supertilt</p>
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
        <p>Cordialement,<br/>L'équipe Supertilt</p>
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
    console.log("Subject:", subject);
    console.log("Attachments:", attachments.length);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Supertilt Formation <noreply@supertilt.fr>",
        to: [recipientEmail],
        bcc: ["romain@supertilt.fr"],
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
