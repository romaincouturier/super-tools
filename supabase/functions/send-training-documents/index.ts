import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Format date for display (e.g., "15 janvier 2025")
function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Format date range for subject line
function formatDateRangeForSubject(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
  };
  
  if (!end || start.getTime() === end.getTime()) {
    // Single day
    return new Intl.DateTimeFormat("fr-FR", formatOptions).format(start);
  }
  
  // Date range
  const startFormatted = new Intl.DateTimeFormat("fr-FR", formatOptions).format(start);
  const endFormatted = new Intl.DateTimeFormat("fr-FR", formatOptions).format(end);
  
  return `${startFormatted} - ${endFormatted}`;
}

// Strip HTML tags for plain text version
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      trainingId, 
      trainingName,
      startDate,
      endDate,
      recipientEmail, 
      recipientName, 
      recipientFirstName,
      documentType,
      invoiceUrl,
      attendanceSheetsUrls,
      certificateUrls,
      ccEmail,
      formalAddress = true // default to vouvoiement
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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch BCC settings
    const bccList = await getBccList();

    // Get Signitic signature
    const signature = await getSigniticSignature();

    // Build email content based on document type
    let subject = "";
    let htmlContent = "";
    const attachments: Array<{ filename: string; path: string }> = [];

    // Use recipientFirstName if provided, otherwise extract from recipientName
    const firstName = recipientFirstName || (recipientName ? recipientName.split(" ")[0] : null);
    console.log("DEBUG - recipientFirstName:", recipientFirstName, "recipientName:", recipientName, "firstName:", firstName, "formalAddress:", formalAddress);
    // Tutoiement: "Bonjour Prénom," / Vouvoiement: "Bonjour,"
    const greeting = formalAddress ? "Bonjour," : (firstName ? `Bonjour ${firstName},` : "Bonjour,");
    console.log("DEBUG - greeting:", greeting);
    
    // Generate phrases based on formal/informal address
    const hopePhrase = formalAddress 
      ? "J'espère que vous allez bien !"
      : "J'espère que tu vas bien !";
    const availabilityPhrase = formalAddress
      ? "Je reste à votre disposition si vous avez la moindre question."
      : "Je reste à ta disposition si tu as la moindre question.";
    const thanksPhrase = formalAddress
      ? "Merci encore pour votre confiance, c'est toujours un plaisir de collaborer avec vous !"
      : "Merci encore pour ta confiance, c'est toujours un plaisir de collaborer avec toi !";

    // Format date string for subject
    const dateInfo = startDate ? formatDateRangeForSubject(startDate, endDate) : "";
    const trainingInfo = trainingName ? `${trainingName}${dateInfo ? ` - ${dateInfo}` : ""}` : "";

    if (documentType === "invoice" && invoiceUrl) {
      subject = trainingInfo 
        ? `Facture - ${trainingInfo} - Supertilt`
        : "Votre facture de formation - Supertilt";
      const invoiceText = formalAddress
        ? "Veuillez trouver ci-joint la facture correspondant à notre récente formation."
        : "Tu trouveras ci-joint la facture correspondant à notre récente formation.";
      htmlContent = `
        <p>${greeting}</p>
        <p>${hopePhrase}</p>
        <p>${invoiceText} ${availabilityPhrase}</p>
        <p>${thanksPhrase}</p>
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
      const docText = sheetsCount > 1 ? "les documents" : "le document";
      
      subject = trainingInfo 
        ? `Émargements - ${trainingInfo} - Supertilt`
        : "Feuilles d'émargement - Supertilt";
      const transmitText = formalAddress
        ? `Comme convenu, je vous transmets ${sheetsText} de notre formation. Vous trouverez ${docText} en pièce jointe.`
        : `Comme convenu, je te transmets ${sheetsText} de notre formation. Tu trouveras ${docText} en pièce jointe.`;
      const needText = formalAddress
        ? "N'hésitez pas à me faire signe si vous avez besoin de quoi que ce soit d'autre."
        : "N'hésite pas à me faire signe si tu as besoin de quoi que ce soit d'autre.";
      htmlContent = `
        <p>${greeting}</p>
        <p>${hopePhrase}</p>
        <p>${transmitText}</p>
        <p>${needText}</p>
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
    } else if (documentType === "certificates" && certificateUrls?.length > 0) {
      const certCount = certificateUrls.length;
      subject = trainingInfo 
        ? `Certificats de réalisation - ${trainingInfo} - Supertilt`
        : "Certificats de réalisation - Supertilt";
      const certText = formalAddress
        ? `Veuillez trouver ci-joint ${certCount > 1 ? "les certificats de réalisation" : "le certificat de réalisation"} de notre formation.`
        : `Tu trouveras ci-joint ${certCount > 1 ? "les certificats de réalisation" : "le certificat de réalisation"} de notre formation.`;
      htmlContent = `
        <p>${greeting}</p>
        <p>${hopePhrase}</p>
        <p>${certText} ${availabilityPhrase}</p>
        <p>${thanksPhrase}</p>
        <p>Belle journée,</p>
        ${signature}
      `;
      certificateUrls.forEach((url: string, index: number) => {
        attachments.push({
          filename: `Certificat_${index + 1}.pdf`,
          path: url,
        });
      });
    } else if (documentType === "all") {
      const sheetsCount = attendanceSheetsUrls?.length || 0;
      const certCount = certificateUrls?.length || 0;
      
      // Build subject
      const parts: string[] = [];
      if (invoiceUrl) parts.push("Facture");
      if (sheetsCount > 0) parts.push("émargements");
      if (certCount > 0) parts.push("certificats");
      
      subject = trainingInfo 
        ? `${parts.join(", ")} - ${trainingInfo} - Supertilt`
        : `${parts.join(", ")} - Supertilt`;
      if (!subject || parts.length === 0) subject = `Documents - ${trainingInfo} - Supertilt`;

      const findText = formalAddress
        ? "Veuillez trouver ci-joint les documents relatifs à notre formation :"
        : "Tu trouveras ci-joint les documents relatifs à notre formation :";
      const questionsText = formalAddress
        ? "Je reste disponible si vous avez des questions ou besoin d'informations complémentaires."
        : "Je reste disponible si tu as des questions ou besoin d'informations complémentaires.";
      htmlContent = `
        <p>${greeting}</p>
        <p>${hopePhrase}</p>
        <p>${findText}</p>
        <ul style="margin: 10px 0;">
          ${invoiceUrl ? "<li>La facture</li>" : ""}
          ${sheetsCount > 0 ? `<li>${sheetsCount > 1 ? "Les feuilles d'émargement" : "La feuille d'émargement"}</li>` : ""}
          ${certCount > 0 ? `<li>${certCount > 1 ? "Les certificats de réalisation" : "Le certificat de réalisation"}</li>` : ""}
        </ul>
        <p>${questionsText}</p>
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
      certificateUrls?.forEach((url: string, index: number) => {
        attachments.push({
          filename: `Certificat_${index + 1}.pdf`,
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

    const senderFrom = await getSenderFrom();

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFrom,
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList,
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

    // Log activity with email subject and content
    try {
      await supabase.from("activity_logs").insert({
        action_type: "training_documents_sent",
        recipient_email: recipientEmail,
        details: {
          training_id: trainingId,
          training_name: trainingName,
          document_type: documentType,
          recipient_name: recipientName,
          attachments_count: attachments.length,
          email_subject: subject,
          email_content: stripHtml(htmlContent),
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

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
