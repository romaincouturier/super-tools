import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  isAdministration: boolean;
  noteDevis: string;
  formationDemandee: string;
  dateFormation: string;
  lieu: string;
  includeCadeau: boolean;
  fraisDossier: boolean;
  prix: number;
  dureeHeures: number;
  programmeUrl: string | null;
  nbParticipants: number;
  participants: string; // Liste des participants (texte brut)
  typeSubrogation?: "sans" | "avec" | "les2"; // Optional for backward compatibility
  // Additional fields for duplication feature
  typeDevis?: "formation" | "jeu";
  formatFormation?: "intra" | "inter";
  formationLibre?: string;
  dateFormationLibre?: string;
  lieuAutre?: string;
  // CRM card link
  crmCardId?: string;
  senderEmail?: string;
}

interface EmailAttachmentPayload {
  filename: string;
  content: string;
}

const PDFMONKEY_TEMPLATE_ID = "C3BC00C9-232F-4ADD-9D1F-9FD176573E93";

async function generatePdfWithPdfMonkey(
  data: RequestBody,
  subrogation: boolean
): Promise<{ pdfUrl: string; documentId: string }> {
  const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
  
  if (!pdfMonkeyApiKey) {
    throw new Error("PDFMONKEY_API_KEY is not set");
  }

  console.log(`Generating PDF with subrogation=${subrogation}...`);

  // Parse participants list
  const participantsList = data.participants
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Build cadeau text if included
  const cadeauText = data.includeCadeau 
    ? "Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation en facilitation graphique"
    : "";

  // Build the payload in the expected structure
  const payload = {
    client: {
      name: data.nomClient,
      address: data.adresseClient,
      zip: data.codePostalClient,
      city: data.villeClient,
      country: data.pays,
    },
    note: data.noteDevis || "",
    affiche_frais: data.fraisDossier ? "Oui" : "Non",
    subrogation: subrogation ? "Oui" : "Non",
    cadeau: cadeauText,
    items: [
      {
        name: data.formationDemandee,
        participant_name: participantsList.length > 0 ? participantsList : [`${data.adresseCommanditaire} ${data.emailCommanditaire}`],
        date: data.dateFormation,
        place: data.lieu,
        duration: `${data.dureeHeures}h`,
        quantity: data.nbParticipants,
        unit_price: data.prix,
      },
    ],
    admin_fee: data.fraisDossier ? 150 : 0,
    is_administration: data.isAdministration,
  };

  console.log(`PDF Monkey payload:`, JSON.stringify(payload));

  // Create document
  const createResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${pdfMonkeyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: {
        document_template_id: PDFMONKEY_TEMPLATE_ID,
        payload: payload,
        status: "pending",
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("PDF Monkey create error:", errorText);
    throw new Error(`Failed to create PDF document: ${errorText}`);
  }

  const createData = await createResponse.json();
  const documentId = createData.document.id;
  console.log(`Document created with ID: ${documentId}`);

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(
      `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
      {
        headers: {
          "Authorization": `Bearer ${pdfMonkeyApiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check document status`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.document.status;
    
    console.log(`Document status: ${status}`);

    if (status === "success") {
      const pdfUrl = statusData.document.download_url;
      console.log(`PDF ready: ${pdfUrl}`);
      return { pdfUrl, documentId };
    } else if (status === "failure") {
      throw new Error(`PDF generation failed: ${statusData.document.failure_cause}`);
    }

    attempts++;
  }

  throw new Error("PDF generation timed out");
}

/**
 * Download a PDF from its URL and store it in Supabase Storage.
 * Returns the storage path, or null on failure.
 */
async function persistPdfToStorage(
  supabase: any,
  pdfUrl: string,
  cardId: string | null,
  suffix: string,
): Promise<string | null> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      console.warn(`Failed to download PDF: ${response.status}`);
      return null;
    }
    const pdfBuffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const folder = cardId || "unlinked";
    const storagePath = `${folder}/${timestamp}_${suffix}.pdf`;

    const { error } = await supabase.storage
      .from("devis-pdfs")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.warn("Failed to upload PDF to storage:", error);
      return null;
    }
    console.log(`PDF persisted to storage: ${storagePath}`);
    return storagePath;
  } catch (err) {
    console.warn("Error persisting PDF:", err);
    return null;
  }
}

/**
 * Persist email attachments in private CRM storage bucket.
 */
async function persistEmailAttachmentsToStorage(
  supabase: any,
  attachments: EmailAttachmentPayload[],
  cardId: string,
): Promise<string[]> {
  const attachmentPaths: string[] = [];

  for (const attachment of attachments) {
    try {
      const base64Content = attachment.content.includes(",")
        ? attachment.content.split(",").pop() || ""
        : attachment.content;

      if (!base64Content) continue;

      const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
      const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `emails/${cardId}/${Date.now()}_${safeFilename}`;

      const { error } = await supabase.storage
        .from("crm-attachments")
        .upload(storagePath, bytes, {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (error) {
        console.warn("Failed to upload CRM attachment:", attachment.filename, error);
        continue;
      }

      attachmentPaths.push(storagePath);
    } catch (err) {
      console.warn("Error while persisting CRM attachment:", attachment.filename, err);
    }
  }

  return attachmentPaths;
}

// Process template with variables (same logic as other emails)
function processTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template;

  // Process conditional blocks: {{#var}}content{{/var}}
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(conditionalRegex, (match, varName, content) => {
    const value = variables[varName];
    return value ? content : "";
  });

  // Process simple variables: {{var}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (match, varName) => {
    const value = variables[varName];
    return value || "";
  });

  return result;
}

// Convert plain text to HTML
function textToHtml(text: string): string {
  return text
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === "") return "";
      // Convert markdown-style list items to HTML
      if (trimmed.startsWith("- ")) return `<p style="margin:0 0 4px 0;">${trimmed.substring(2)}</p>`;
      if (trimmed.startsWith("* ")) return `<p style="margin:0 0 4px 0;padding-left:16px;">${trimmed.substring(2)}</p>`;
      return `<p style="margin:0 0 8px 0;">${trimmed}</p>`;
    })
    .filter(line => line !== "")
    .join("\n");
}

// Check if a string looks like HTML content
function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

// Default template content
const DEFAULT_SUBJECT = "Votre devis pour la formation \"{{formation_name}}\"";
const DEFAULT_CONTENT = `Bonjour {{recipient_name}},

Merci pour votre demande concernant la formation "{{formation_name}}".

Vous trouverez en pièces jointes :

{{devis_description}}

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement ici : {{programme_link}}
{{/programme_link}}

N'hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.

À très bientôt,`;

async function sendEmailWithResend(
  supabase: any,
  emailCommanditaire: string,
  adresseCommanditaire: string,
  formationDemandee: string,
  programmeUrl: string | null,
  pdfUrlSansSubrogation: string | null,
  pdfUrlAvecSubrogation: string | null,
  typeSubrogation: "sans" | "avec" | "les2"
): Promise<{ subject: string; htmlContent: string; attachmentNames: string[]; attachments: EmailAttachmentPayload[] }> {
  console.log(`Sending email to ${emailCommanditaire}...`);

  // Fetch custom email template if exists (micro_devis always uses vouvoiement)
  const { data: customTemplate } = await supabase
    .from("email_templates")
    .select("subject, html_content")
    .eq("template_type", "micro_devis_vous")
    .single();

  const subjectTemplate = customTemplate?.subject || DEFAULT_SUBJECT;
  const contentTemplate = customTemplate?.html_content || DEFAULT_CONTENT;

  console.log("Using template:", customTemplate ? "custom" : "default");

  // Fetch Signitic signature and email settings
  const emailSignature = await getSigniticSignature();

  // Download PDFs based on type
  let pdfSansSubrogation: ArrayBuffer | null = null;
  let pdfAvecSubrogation: ArrayBuffer | null = null;

  if (typeSubrogation === "sans" || typeSubrogation === "les2") {
    if (pdfUrlSansSubrogation) {
      pdfSansSubrogation = await fetch(pdfUrlSansSubrogation).then(r => r.arrayBuffer());
    }
  }
  if (typeSubrogation === "avec" || typeSubrogation === "les2") {
    if (pdfUrlAvecSubrogation) {
      pdfAvecSubrogation = await fetch(pdfUrlAvecSubrogation).then(r => r.arrayBuffer());
    }
  }

  // Fetch Qualiopi certificate from Supabase Storage bucket
  const { getAppUrls } = await import("../_shared/app-urls.ts");
  const urls = await getAppUrls();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const qualiopiPath = urls.qualiopi_certificate_path;
  const qualiopiPublicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURI(qualiopiPath)}`;
  
  let qualiopiCertificate: ArrayBuffer | null = null;
  try {
    const qualiopiResponse = await fetch(qualiopiPublicUrl);
    if (qualiopiResponse.ok) {
      qualiopiCertificate = await qualiopiResponse.arrayBuffer();
      console.log("Qualiopi certificate fetched successfully");
    } else {
      console.warn("Could not fetch Qualiopi certificate:", qualiopiResponse.status);
    }
  } catch (error) {
    console.warn("Error fetching Qualiopi certificate:", error);
  }

    // Build devis description based on type (as HTML for proper rendering)
    let devisDescription = "";
    if (typeSubrogation === "les2") {
      devisDescription = `<ul style="margin:8px 0;padding-left:20px;">
        <li>Un devis sans subrogation de paiement : vous réglez directement la formation</li>
        <li>Un devis avec subrogation de paiement : votre OPCO règle directement la formation</li>
        <li>Notre certificat Qualiopi, attestant de la qualité de nos formations</li>
      </ul>`;
    } else if (typeSubrogation === "sans") {
      devisDescription = `<ul style="margin:8px 0;padding-left:20px;">
        <li>Notre devis sans subrogation de paiement : vous réglez directement la formation</li>
        <li>Notre certificat Qualiopi, attestant de la qualité de nos formations</li>
      </ul>`;
    } else {
      devisDescription = `<ul style="margin:8px 0;padding-left:20px;">
        <li>Notre devis avec subrogation de paiement : votre OPCO règle directement la formation</li>
        <li>Notre certificat Qualiopi, attestant de la qualité de nos formations</li>
      </ul>`;
    }

    // Remove duplicate "formation" from formation name for subject
    const formationName = formationDemandee.replace(/^formation\s+/i, "");

    // Process templates with variables
    const variables = {
      recipient_name: adresseCommanditaire,
      formation_name: formationName,
      devis_description: devisDescription,
      programme_link: programmeUrl,
    };

    const subject = processTemplate(subjectTemplate, variables);
    // Check if the RAW template (before variable substitution) is HTML
    // Variables like devis_description contain HTML, which would fool isHtmlContent
    // on the processed result. We must check the original template instead.
    const templateIsHtml = isHtmlContent(contentTemplate);
    const contentProcessed = processTemplate(contentTemplate, variables);
    const contentHtml = templateIsHtml ? contentProcessed : textToHtml(contentProcessed);

  // Fallback signature if Signitic fails
  const websiteUrl = urls.website_url;
  const fallbackSignature = `
    <p style="margin-top: 20px;">
      <strong>Romain</strong><br>
      <a href="${websiteUrl}" style="color: #666; text-decoration: underline;">SuperTilt</a>
    </p>
  `;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
      ${contentHtml}
      ${emailSignature || fallbackSignature}
    </div>
  `;

  // Build attachments array
  const attachments: EmailAttachmentPayload[] = [];
  
  if (pdfSansSubrogation) {
    attachments.push({
      filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_sans_subrogation.pdf`,
      content: base64Encode(pdfSansSubrogation),
    });
  }
  
  if (pdfAvecSubrogation) {
    attachments.push({
      filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_avec_subrogation.pdf`,
      content: base64Encode(pdfAvecSubrogation),
    });
  }
  
  // Add Qualiopi certificate if available
  if (qualiopiCertificate) {
    attachments.push({
      filename: "Certificat_Qualiopi_Supertilt.pdf",
      content: base64Encode(qualiopiCertificate),
    });
  }
  
  const senderFrom = await getSenderFrom();
  const bccList = await getBccList();

  const emailResponse = await sendEmail({
    from: senderFrom,
    to: [emailCommanditaire],
    bcc: bccList,
    subject,
    html: htmlContent,
    attachments,
    _emailType: "micro_devis",
  });

  if (!emailResponse.success) {
    const errorMessage = emailResponse.error || "Échec de l'envoi du micro-devis";
    console.error("Micro-devis email send failed:", errorMessage);
    throw new Error(errorMessage);
  }

  console.log("Email sent successfully:", emailResponse);
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log("Received request:", JSON.stringify(body));

    // Validate required fields
    if (!body.emailCommanditaire || !body.formationDemandee) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to "les2" for backward compatibility
    const typeSubrogation = body.typeSubrogation || "les2";
    
    let pdfSansSubrogation: { pdfUrl: string; documentId: string } | null = null;
    let pdfAvecSubrogation: { pdfUrl: string; documentId: string } | null = null;

    // Generate PDFs based on type
    if (typeSubrogation === "sans" || typeSubrogation === "les2") {
      console.log("Generating PDF without subrogation...");
      pdfSansSubrogation = await generatePdfWithPdfMonkey(body, false);
    }

    if (typeSubrogation === "avec" || typeSubrogation === "les2") {
      console.log("Generating PDF with subrogation...");
      pdfAvecSubrogation = await generatePdfWithPdfMonkey(body, true);
    }

    // Send email with PDFs
    console.log("Sending email with PDF(s)...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const emailResult = await sendEmailWithResend(
      supabase,
      body.emailCommanditaire,
      body.adresseCommanditaire,
      body.formationDemandee,
      body.programmeUrl,
      pdfSansSubrogation?.pdfUrl || null,
      pdfAvecSubrogation?.pdfUrl || null,
      typeSubrogation
    );

    // Auto-resolve crmCardId by matching email if not explicitly provided
    let resolvedCrmCardId = body.crmCardId || null;
    if (!resolvedCrmCardId && body.emailCommanditaire) {
      try {
        const { data: matchingCard } = await supabase
          .from("crm_cards")
          .select("id")
          .eq("email", body.emailCommanditaire)
          .eq("sales_status", "OPEN")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (matchingCard) {
          resolvedCrmCardId = matchingCard.id;
          console.log(`Auto-linked micro-devis to CRM card ${resolvedCrmCardId} via email match`);
        }
      } catch {
        // No matching card found, that's fine
      }
    }

    // Persist PDFs to Supabase Storage for permanent access
    let storageSansPath: string | null = null;
    let storageAvecPath: string | null = null;
    if (pdfSansSubrogation?.pdfUrl) {
      storageSansPath = await persistPdfToStorage(supabase, pdfSansSubrogation.pdfUrl, resolvedCrmCardId, "sans_subrogation");
    }
    if (pdfAvecSubrogation?.pdfUrl) {
      storageAvecPath = await persistPdfToStorage(supabase, pdfAvecSubrogation.pdfUrl, resolvedCrmCardId, "avec_subrogation");
    }

    // Auto-move CRM card to "Devis envoyé" column if linked
    if (resolvedCrmCardId) {
      try {
        const { data: devisColumn } = await supabase
          .from("crm_columns")
          .select("id")
          .ilike("name", "%devis envoy%")
          .limit(1)
          .single();
        if (devisColumn) {
          const { data: currentCard } = await supabase
            .from("crm_cards")
            .select("column_id")
            .eq("id", resolvedCrmCardId)
            .single();
          if (currentCard && currentCard.column_id !== devisColumn.id) {
            await supabase.from("crm_cards")
              .update({ column_id: devisColumn.id })
              .eq("id", resolvedCrmCardId);
            // Log column change
            await supabase.from("crm_activity_log").insert({
              card_id: resolvedCrmCardId,
              action_type: "card_moved",
              old_value: currentCard.column_id,
              new_value: devisColumn.id,
              metadata: { source: "auto_devis_sent" },
              actor_email: body.senderEmail || "system",
            });
            console.log(`CRM card ${resolvedCrmCardId} auto-moved to "Devis envoyé" column`);
          }
        }
      } catch (moveErr) {
        console.warn("Failed to auto-move card to Devis envoyé:", moveErr);
      }
    }

    // Track email in CRM card if linked
    if (resolvedCrmCardId) {
      try {
        // Build body_html with attachment info
        const attachmentInfo = emailResult.attachmentNames.length > 0
          ? `<div style="margin-top:12px;padding:8px 12px;background:#f3f4f6;border-radius:6px;font-size:12px;color:#6b7280;">📎 Pièces jointes : ${emailResult.attachmentNames.join(", ")}</div>`
          : "";
        const bodyWithAttachments = emailResult.htmlContent + attachmentInfo;

        const contactEmail = await getSenderEmail();
        const attachmentPaths = await persistEmailAttachmentsToStorage(
          supabase,
          emailResult.attachments,
          resolvedCrmCardId,
        );

        // Insert into crm_card_emails
        await supabase.from("crm_card_emails").insert({
          card_id: resolvedCrmCardId,
          sender_email: body.senderEmail || contactEmail,
          recipient_email: body.emailCommanditaire,
          subject: emailResult.subject,
          body_html: bodyWithAttachments,
          attachment_names: emailResult.attachmentNames,
          attachment_paths: attachmentPaths.length > 0 ? attachmentPaths : null,
        });

        // Log activity
        await supabase.from("crm_activity_log").insert({
          card_id: resolvedCrmCardId,
          action_type: "email_sent",
          old_value: null,
          new_value: `To: ${body.emailCommanditaire} - ${emailResult.subject}`,
          metadata: { source: "micro_devis", attachments: emailResult.attachmentNames },
          actor_email: body.senderEmail || contactEmail,
        });

        // Schedule follow-up 3 working days later
        const defaultWorkingDays = [false, true, true, true, true, true, false];
        let workingDays = defaultWorkingDays;
        try {
          const { data: wdSetting } = await supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "working_days")
            .single();
          if (wdSetting?.setting_value) {
            const parsed = JSON.parse(wdSetting.setting_value);
            if (Array.isArray(parsed) && parsed.length === 7) {
              workingDays = parsed;
            }
          }
        } catch { /* use default */ }

        // Calculate 3 working days from now
        let followUpDate = new Date();
        let remaining = 3;
        while (remaining > 0) {
          followUpDate.setDate(followUpDate.getDate() + 1);
          if (workingDays[followUpDate.getDay()]) {
            remaining--;
          }
        }
        const followUpDateStr = followUpDate.toISOString().split("T")[0];

        await supabase.from("crm_cards")
          .update({
            status_operational: "WAITING",
            waiting_next_action_date: followUpDateStr,
            waiting_next_action_text: "Relancer le client suite à l'envoi du devis",
          })
          .eq("id", resolvedCrmCardId);

        console.log(`CRM card ${resolvedCrmCardId}: email tracked, follow-up scheduled for ${followUpDateStr}`);
      } catch (crmError) {
        console.warn("Failed to track email in CRM:", crmError);
      }
    }

    // Log activity with all form data for duplication feature
    try {
      await supabase.from("activity_logs").insert({
        action_type: "micro_devis_sent",
        recipient_email: body.emailCommanditaire,
        details: {
          crm_card_id: resolvedCrmCardId || null,
          formation_name: body.formationDemandee,
          client_name: body.nomClient,
          type_subrogation: typeSubrogation,
          nb_participants: body.nbParticipants,
          pdf_sans_subrogation_url: pdfSansSubrogation?.pdfUrl || null,
          pdf_avec_subrogation_url: pdfAvecSubrogation?.pdfUrl || null,
          pdf_sans_storage_path: storageSansPath,
          pdf_avec_storage_path: storageAvecPath,
          // Store all form data for duplication
          form_data: {
            nomClient: body.nomClient,
            adresseClient: body.adresseClient,
            codePostalClient: body.codePostalClient,
            villeClient: body.villeClient,
            pays: body.pays,
            emailCommanditaire: body.emailCommanditaire,
            adresseCommanditaire: body.adresseCommanditaire,
            isAdministration: body.isAdministration,
            noteDevis: body.noteDevis,
            formationDemandee: body.formationDemandee,
            formationLibre: body.formationLibre || "",
            dateFormation: body.dateFormation,
            dateFormationLibre: body.dateFormationLibre || "",
            lieu: body.lieu,
            lieuAutre: body.lieuAutre || "",
            includeCadeau: body.includeCadeau,
            fraisDossier: body.fraisDossier,
            participants: body.participants,
            typeSubrogation: typeSubrogation,
            typeDevis: body.typeDevis || "formation",
            formatFormation: body.formatFormation || "inter",
          },
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    const message = typeSubrogation === "les2" 
      ? "Devis générés et envoyés avec succès"
      : "Devis généré et envoyé avec succès";

    return new Response(
      JSON.stringify({
        success: true,
        message,
        pdfSansSubrogation: pdfSansSubrogation?.pdfUrl || null,
        pdfAvecSubrogation: pdfAvecSubrogation?.pdfUrl || null,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
