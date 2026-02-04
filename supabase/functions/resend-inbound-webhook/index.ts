import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Verify webhook signature if secret is configured
    if (RESEND_WEBHOOK_SECRET) {
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
    } else {
      console.warn("RESEND_WEBHOOK_SECRET not configured - skipping signature verification");
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

    return new Response(
      JSON.stringify({
        success: true,
        email_id: insertedEmail.id,
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
