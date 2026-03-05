import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate, textToHtml } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Format date range for display (e.g., "du 15 au 17 janvier 2025")
function formatDateRangeForDisplay(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  if (!end || start.getTime() === end.getTime()) {
    return `le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(start)}`;
  }

  const startFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(start);
  const endFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(end);
  return `du ${startFmt} au ${endFmt}`;
}

// Format date range for subject line
function formatDateRangeForSubject(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  const formatOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };

  if (!end || start.getTime() === end.getTime()) {
    return new Intl.DateTimeFormat("fr-FR", formatOptions).format(start);
  }

  const startFormatted = new Intl.DateTimeFormat("fr-FR", formatOptions).format(start);
  const endFormatted = new Intl.DateTimeFormat("fr-FR", formatOptions).format(end);
  return `${startFormatted} - ${endFormatted}`;
}

// Strip HTML tags for plain text version
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
      formalAddress = true
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

    // Determine template type suffix based on formal address
    const templateTypeSuffix = formalAddress ? "_vous" : "_tu";
    const templateType = `training_documents${templateTypeSuffix}`;

    // Fetch template, BCC, and signature in parallel
    const [templateResult, bccList, signature] = await Promise.all([
      supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", templateType)
        .maybeSingle(),
      getBccList(),
      getSigniticSignature(),
    ]);

    const customTemplate = templateResult.data;

    // Default templates
    const defaultSubjectTu = "Documents de la formation \"{{training_name}}\"";
    const defaultSubjectVous = "Documents de la formation \"{{training_name}}\"";
    const defaultContentTu = `{{greeting}},

Voici les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.
{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}
{{#has_certificates}}
- Les certificats de réalisation
{{/has_certificates}}

N'hésite pas à me contacter si tu as des questions.

Bonne réception.`;
    const defaultContentVous = `{{greeting}},

Veuillez trouver ci-joint les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.
{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}
{{#has_certificates}}
- Les certificats de réalisation
{{/has_certificates}}

N'hésitez pas à me contacter si vous avez des questions.

Bonne réception.`;

    const defaultSubject = formalAddress ? defaultSubjectVous : defaultSubjectTu;
    const defaultContent = formalAddress ? defaultContentVous : defaultContentTu;

    const subjectTemplate = customTemplate?.subject || defaultSubject;
    const contentTemplate = customTemplate?.html_content || defaultContent;

    console.log("Using template:", customTemplate ? "custom" : "default", "mode:", formalAddress ? "vouvoiement" : "tutoiement");

    // Build greeting
    const firstName = recipientFirstName || (recipientName ? recipientName.split(" ")[0] : null);
    const greeting = formalAddress ? "Bonjour" : (firstName ? `Bonjour ${firstName}` : "Bonjour");

    // Build date info
    const trainingDates = startDate ? formatDateRangeForDisplay(startDate, endDate) : "";
    const dateInfo = startDate ? formatDateRangeForSubject(startDate, endDate) : "";

    // Determine which documents are present
    const hasInvoice = documentType === "invoice" || (documentType === "all" && !!invoiceUrl);
    const hasSheets = documentType === "sheets" || (documentType === "all" && attendanceSheetsUrls?.length > 0);
    const hasCertificates = documentType === "certificates" || (documentType === "all" && certificateUrls?.length > 0);

    // Build template variables
    const variables = {
      greeting,
      first_name: firstName,
      training_name: trainingName || "",
      training_dates: trainingDates,
      has_invoice: hasInvoice ? "true" : null,
      has_sheets: hasSheets ? "true" : null,
      has_certificates: hasCertificates ? "true" : null,
    };

    // Process subject with training name and date info
    let subject = processTemplate(subjectTemplate, variables, false);
    // Append date info to subject if available
    if (dateInfo && !subject.includes(dateInfo)) {
      // Build a more specific subject for single doc types
      if (documentType === "invoice") {
        subject = `Facture - ${trainingName || ""}${dateInfo ? ` - ${dateInfo}` : ""} - Supertilt`;
      } else if (documentType === "sheets") {
        subject = `Émargements - ${trainingName || ""}${dateInfo ? ` - ${dateInfo}` : ""} - Supertilt`;
      } else if (documentType === "certificates") {
        subject = `Certificats de réalisation - ${trainingName || ""}${dateInfo ? ` - ${dateInfo}` : ""} - Supertilt`;
      }
    }

    // Process content template
    const contentText = processTemplate(contentTemplate, variables, false);
    const contentHtml = textToHtml(contentText);

    const htmlContent = `${contentHtml}\n${signature}`;

    // Build attachments
    const attachments: Array<{ filename: string; path: string }> = [];

    if ((documentType === "invoice" || documentType === "all") && invoiceUrl) {
      attachments.push({ filename: "Facture.pdf", path: invoiceUrl });
    }
    if ((documentType === "sheets" || documentType === "all") && attendanceSheetsUrls?.length > 0) {
      attendanceSheetsUrls.forEach((url: string, index: number) => {
        const extension = url.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif|webp)$/)?.[1] || "pdf";
        attachments.push({ filename: `Feuille_emargement_${index + 1}.${extension}`, path: url });
      });
    }
    if ((documentType === "certificates" || documentType === "all") && certificateUrls?.length > 0) {
      certificateUrls.forEach((url: string, index: number) => {
        attachments.push({ filename: `Certificat_${index + 1}.pdf`, path: url });
      });
    }

    if (attachments.length === 0) {
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

    const result = await sendEmail({
      from: senderFrom,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList,
      subject,
      html: htmlContent,
      attachments,
      _emailType: "training_documents",
      _trainingId: trainingId,
      _participantId: participantId || undefined,
    });

    console.log("Email sent successfully:", result.id);

    // Log activity
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
