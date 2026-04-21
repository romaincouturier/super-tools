import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { decode as base64Decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

import { extendCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const corsHeaders = extendCorsHeaders({
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// ─── CRM helpers ───────────────────────────────────────────────────────

interface BriefQuestion {
  id: string;
  question: string;
  answered: boolean;
}

interface ExtractionResult {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  service_type: "formation" | "mission" | null;
  title: string;
  brief_questions: BriefQuestion[];
}

function extractCompanyFromEmail(email: string): string | null {
  const match = email.match(/@([^.]+)\./);
  if (match) {
    const domain = match[1].toLowerCase();
    const commonProviders = ["gmail", "yahoo", "hotmail", "outlook", "orange", "free", "sfr", "laposte", "wanadoo", "live", "icloud", "protonmail"];
    if (!commonProviders.includes(domain)) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  return null;
}

function capitalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().toLowerCase().replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

async function extractOpportunityFromEmail(rawInput: string, senderEmail: string): Promise<ExtractionResult> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const systemPrompt = `Tu es un assistant qui analyse des emails entrants pour un organisme de formation professionnelle.

À partir de l'email fourni, extrais les informations suivantes au format JSON:
- first_name: prénom de la personne qui écrit
- last_name: nom de famille
- phone: numéro de téléphone (formaté)
- company: nom de l'entreprise
- email: adresse email de l'expéditeur
- linkedin_url: URL LinkedIn si mentionnée
- service_type: "formation" ou "mission" selon le contexte
- title: titre descriptif pour l'opportunité (format: "(ENTREPRISE) Intitulé de la prestation")
- brief_questions: tableau de 3-5 questions pertinentes à poser lors du brief initial

Règles:
- Si une information n'est pas présente, utilise null
- Le nom de l'entreprise peut être déduit du domaine de l'email
- Pour le titre, utilise le format "(ENTREPRISE) Description courte de la prestation"
- Les questions du brief doivent être pertinentes pour qualifier l'opportunité
- Si le type de prestation n'est pas clair, utilise null

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawInput },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", errorText);
    throw new Error(`Failed to extract information: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";

  try {
    const extracted = JSON.parse(content);

    // Fallback: use sender email if AI didn't extract one
    if (!extracted.email && senderEmail) {
      extracted.email = senderEmail;
    }

    // Extract company from email if not found
    if (!extracted.company && extracted.email) {
      extracted.company = extractCompanyFromEmail(extracted.email);
    }

    // Generate title if not provided
    if (!extracted.title) {
      const companyPart = extracted.company ? `(${extracted.company.toUpperCase()})` : "(INCONNU)";
      const servicePart = extracted.service_type === "formation" ? "Formation" :
                          extracted.service_type === "mission" ? "Mission" : "Nouvelle opportunité";
      extracted.title = `${companyPart} ${servicePart}`;
    }

    // Add IDs to brief questions
    const briefQuestions: BriefQuestion[] = (extracted.brief_questions || []).map((q: string | { question: string }) => ({
      id: crypto.randomUUID(),
      question: typeof q === "string" ? q : q.question,
      answered: false,
    }));

    if (briefQuestions.length === 0) {
      briefQuestions.push(
        { id: crypto.randomUUID(), question: "Quel est le contexte de cette demande ?", answered: false },
        { id: crypto.randomUUID(), question: "Quel est le budget envisagé ?", answered: false },
        { id: crypto.randomUUID(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        { id: crypto.randomUUID(), question: "Combien de personnes sont concernées ?", answered: false }
      );
    }

    return {
      first_name: extracted.first_name || null,
      last_name: extracted.last_name || null,
      phone: extracted.phone || null,
      company: extracted.company || null,
      email: extracted.email || null,
      linkedin_url: extracted.linkedin_url || null,
      service_type: extracted.service_type || null,
      title: extracted.title,
      brief_questions: briefQuestions,
    };
  } catch {
    console.error("Failed to parse AI response:", content);
    const company = extractCompanyFromEmail(senderEmail);
    const companyPart = company ? `(${company.toUpperCase()})` : "(INCONNU)";
    return {
      first_name: null,
      last_name: null,
      phone: null,
      company,
      email: senderEmail,
      linkedin_url: null,
      service_type: null,
      title: `${companyPart} Nouvelle opportunité`,
      brief_questions: [
        { id: crypto.randomUUID(), question: "Quel est le contexte de cette demande ?", answered: false },
        { id: crypto.randomUUID(), question: "Quel est le budget envisagé ?", answered: false },
        { id: crypto.randomUUID(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        { id: crypto.randomUUID(), question: "Combien de personnes sont concernées ?", answered: false },
      ],
    };
  }
}

async function notifySlackFromWebhook(
  supabase: any,
  type: "opportunity_created",
  card: { title: string; company?: string; first_name?: string; last_name?: string; service_type?: string; email?: string },
) {
  try {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_crm_webhook_url")
      .single();

    const webhookUrl = settings?.setting_value;
    if (!webhookUrl) return;

    const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
    const serviceLabel = card.service_type === "formation" ? "Formation" : card.service_type === "mission" ? "Mission" : "";

    const fields: { type: string; text: string }[] = [];
    if (contactName) fields.push({ type: "mrkdwn", text: `*Contact :* ${contactName}` });
    if (card.company) fields.push({ type: "mrkdwn", text: `*Entreprise :* ${card.company}` });
    if (serviceLabel) fields.push({ type: "mrkdwn", text: `*Type :* ${serviceLabel}` });

    const blocks: unknown[] = [
      { type: "header", text: { type: "plain_text", text: "📧 Nouvelle opportunité (email entrant)", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: `*${card.title}*` } },
    ];
    if (fields.length > 0) blocks.push({ type: "section", fields });
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Créée automatiquement depuis un email de ${card.email || "inconnu"}` }] });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Nouvelle opportunité (email) : ${card.title}`, blocks }),
    });
  } catch (e) {
    console.error("Slack notification error (non-fatal):", e);
  }
}

async function createCrmOpportunityFromEmail(
  supabase: any,
  emailData: ResendInboundPayload["data"],
  parsedFrom: { email: string; name: string | null },
  insertedEmailId: string,
): Promise<void> {
  // Check if CRM inbound email is configured
  const { data: crmSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "crm_inbound_email")
    .single();

  const crmInboundEmail = crmSetting?.setting_value?.trim().toLowerCase();
  if (!crmInboundEmail) return;

  // Check if any recipient matches the CRM email
  const allRecipients = emailData.to.map((addr) => parseEmailAddress(addr).email.toLowerCase());
  if (!allRecipients.includes(crmInboundEmail)) return;

  console.log("CRM inbound email matched, creating opportunity...");

  // Build raw input for AI extraction
  const rawInput = [
    emailData.subject ? `Sujet: ${emailData.subject}` : "",
    `De: ${parsedFrom.name ? `${parsedFrom.name} <${parsedFrom.email}>` : parsedFrom.email}`,
    emailData.text || "",
  ].filter(Boolean).join("\n\n");

  // Extract with AI
  const extraction = await extractOpportunityFromEmail(rawInput, parsedFrom.email);

  // Find first non-archived CRM column
  const { data: firstColumn } = await supabase
    .from("crm_columns")
    .select("id")
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!firstColumn) {
    console.error("No CRM column found, skipping card creation");
    return;
  }

  // Get max position in column
  const { data: existingCards } = await supabase
    .from("crm_cards")
    .select("position")
    .eq("column_id", firstColumn.id)
    .order("position", { ascending: false })
    .limit(1);
  const maxPos = existingCards?.[0]?.position ?? -1;

  // Create card
  const { data: newCard, error: cardError } = await supabase
    .from("crm_cards")
    .insert({
      column_id: firstColumn.id,
      title: extraction.title,
      position: maxPos + 1,
      sales_status: "OPEN",
      status_operational: "TODAY",
      estimated_value: 0,
      first_name: capitalizeName(extraction.first_name),
      last_name: capitalizeName(extraction.last_name),
      phone: extraction.phone || null,
      company: extraction.company || null,
      email: normalizeEmail(extraction.email),
      linkedin_url: extraction.linkedin_url || null,
      service_type: extraction.service_type || null,
      brief_questions: extraction.brief_questions as unknown,
      raw_input: rawInput,
      acquisition_source: "email_entrant",
    })
    .select()
    .single();

  if (cardError) {
    console.error("Error creating CRM card:", cardError);
    return;
  }

  console.log("CRM card created from inbound email:", newCard.id);

  // Log activity
  await supabase.from("crm_activity_log").insert({
    card_id: newCard.id,
    action_type: "card_created",
    actor_email: "system@inbound",
    new_value: extraction.title,
  });

  // Mark inbound email as processed
  await supabase
    .from("inbound_emails")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("id", insertedEmailId);

  // Slack notification (fire-and-forget)
  notifySlackFromWebhook(supabase, "opportunity_created", {
    title: extraction.title,
    company: extraction.company || undefined,
    first_name: extraction.first_name || undefined,
    last_name: extraction.last_name || undefined,
    service_type: extraction.service_type || undefined,
    email: parsedFrom.email,
  });
}

// Resend webhook payload structure for inbound emails
interface ResendInboundPayload {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    reply_to?: string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: {
      filename: string;
      content_type: string;
      content: string; // base64
    }[];
    headers?: Record<string, string>;
  };
}

// Verify Resend webhook signature (using Svix)
async function verifyWebhookSignature(
  payload: string,
  headers: {
    svixId: string | null;
    svixTimestamp: string | null;
    svixSignature: string | null;
  },
  webhookSecret: string
): Promise<boolean> {
  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    console.log("Missing Svix headers");
    return false;
  }

  // Check timestamp is within 5 minutes
  const timestamp = parseInt(headers.svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.log("Timestamp too old");
    return false;
  }

  // Compute expected signature
  const signedPayload = `${headers.svixId}.${headers.svixTimestamp}.${payload}`;

  // Remove "whsec_" prefix if present
  const secretBytes = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice(6)
    : webhookSecret;

  // Decode base64 secret
  const secretDecoded = base64Decode(secretBytes);

  // Create HMAC using Web Crypto API
  const key = await crypto.subtle.importKey(
    "raw",
    secretDecoded.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  // Convert to base64
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // Check if any of the signatures match
  const signatures = headers.svixSignature.split(" ");
  for (const sig of signatures) {
    const [version, signature] = sig.split(",");
    if (version === "v1" && signature === expectedSignature) {
      return true;
    }
  }

  console.log("Signature mismatch");
  return false;
}

// Extract email and name from "Name <email@domain.com>" format
function parseEmailAddress(address: string): { email: string; name: string | null } {
  const match = address.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]?.trim() || address,
    };
  }
  return { email: address, name: null };
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payloadText = await req.text();

    // Verify webhook signature — mandatory
    if (!RESEND_WEBHOOK_SECRET) {
      console.error("RESEND_WEBHOOK_SECRET not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook not properly configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyWebhookSignature(
      payloadText,
      {
        svixId: req.headers.get("svix-id"),
        svixTimestamp: req.headers.get("svix-timestamp"),
        svixSignature: req.headers.get("svix-signature"),
      },
      RESEND_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: ResendInboundPayload = JSON.parse(payloadText);

    // Only handle email.received events
    if (payload.type !== "email.received") {
      console.log("Ignoring event type:", payload.type);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailData = payload.data;
    const parsedFrom = parseEmailAddress(emailData.from);

    console.log("Received inbound email from:", parsedFrom.email, "subject:", emailData.subject);

    // Prepare attachments (store metadata, not full content for large files)
    const attachments = emailData.attachments?.map((att) => ({
      filename: att.filename,
      content_type: att.content_type,
      size: att.content ? Math.ceil((att.content.length * 3) / 4) : 0, // Approximate decoded size
      // Note: For large attachments, you might want to store them in Supabase Storage
      // and only keep a reference here
    })) || [];

    // Insert email into database
    const { data: insertedEmail, error: insertError } = await supabase
      .from("inbound_emails")
      .insert({
        message_id: emailData.email_id,
        from_email: parsedFrom.email,
        from_name: parsedFrom.name,
        to_email: emailData.to[0], // Primary recipient
        cc: emailData.cc || [],
        reply_to: emailData.reply_to?.[0] || null,
        subject: emailData.subject,
        text_body: emailData.text,
        html_body: emailData.html,
        attachments: attachments,
        headers: emailData.headers || {},
        status: "received",
        received_at: payload.created_at,
      })
      .select()
      .single();

    if (insertError) {
      // Check if duplicate (message_id unique constraint)
      if (insertError.code === "23505") {
        console.log("Duplicate email, already processed:", emailData.email_id);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("Error inserting email:", insertError);
      throw insertError;
    }

    console.log("Email stored successfully:", insertedEmail.id);

    // Optional: Try to auto-link email to existing entities
    // For example, if the sender email matches a participant or sponsor
    const { data: matchingParticipant } = await supabase
      .from("training_participants")
      .select("id, training_id")
      .eq("email", parsedFrom.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (matchingParticipant) {
      await supabase
        .from("inbound_emails")
        .update({
          linked_participant_id: matchingParticipant.id,
          linked_training_id: matchingParticipant.training_id,
        })
        .eq("id", insertedEmail.id);

      console.log("Auto-linked email to participant:", matchingParticipant.id);
    }

    // CRM: auto-create opportunity if email matches configured CRM address
    let crmCardCreated = false;
    try {
      await createCrmOpportunityFromEmail(supabase, emailData, parsedFrom, insertedEmail.id);
      crmCardCreated = true;
    } catch (crmError) {
      console.error("CRM auto-create error (non-fatal):", crmError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: insertedEmail.id,
        crm_card_created: crmCardCreated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing inbound email:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
