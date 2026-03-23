import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { decode as base64Decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

import { extendCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = extendCorsHeaders({
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

// Resend webhook events for sent email tracking
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked";

interface ResendTrackingPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    created_at: string;
    // Bounce info
    bounce?: { message: string; timestamp: string };
    // Click info
    click?: { ipAddress: string; link: string; timestamp: string; userAgent: string };
    // Open info
    open?: { ipAddress: string; timestamp: string; userAgent: string };
  };
}

const HANDLED_EVENTS: ResendEventType[] = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
];

// Verify Resend webhook signature (Svix HMAC-SHA256)
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
    return false;
  }

  const timestamp = parseInt(headers.svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return false;
  }

  const signedPayload = `${headers.svixId}.${headers.svixTimestamp}.${payload}`;
  const secretBytes = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice(6)
    : webhookSecret;
  const secretDecoded = base64Decode(secretBytes);

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

  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  const signatures = headers.svixSignature.split(" ");
  for (const sig of signatures) {
    const [version, signature] = sig.split(",");
    if (version === "v1" && signature === expectedSignature) {
      return true;
    }
  }
  return false;
}

serve(async (req) => {
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

    // Verify signature
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
    }

    const payload: ResendTrackingPayload = JSON.parse(payloadText);

    if (!HANDLED_EVENTS.includes(payload.type)) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendEmailId = payload.data.email_id;
    if (!resendEmailId) {
      return new Response(JSON.stringify({ error: "Missing email_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Tracking event: ${payload.type} for email ${resendEmailId}`);

    // Build update based on event type
    const now = payload.created_at || new Date().toISOString();

    switch (payload.type) {
      case "email.sent":
        // No extra update needed — already stored as "sent"
        break;

      case "email.delivered":
        await supabase
          .from("crm_card_emails")
          .update({ delivery_status: "delivered", delivered_at: now })
          .eq("resend_email_id", resendEmailId);
        break;

      case "email.bounced":
        await supabase
          .from("crm_card_emails")
          .update({ delivery_status: "bounced" })
          .eq("resend_email_id", resendEmailId);
        break;

      case "email.complained":
        await supabase
          .from("crm_card_emails")
          .update({ delivery_status: "complained" })
          .eq("resend_email_id", resendEmailId);
        break;

      case "email.opened": {
        // Increment open count, set opened_at only on first open
        const { data: existing } = await supabase
          .from("crm_card_emails")
          .select("open_count, opened_at")
          .eq("resend_email_id", resendEmailId)
          .single();

        if (existing) {
          await supabase
            .from("crm_card_emails")
            .update({
              open_count: (existing.open_count || 0) + 1,
              opened_at: existing.opened_at || now,
            })
            .eq("resend_email_id", resendEmailId);
        }
        break;
      }

      case "email.clicked": {
        const { data: existing } = await supabase
          .from("crm_card_emails")
          .select("click_count, clicked_at")
          .eq("resend_email_id", resendEmailId)
          .single();

        if (existing) {
          await supabase
            .from("crm_card_emails")
            .update({
              click_count: (existing.click_count || 0) + 1,
              clicked_at: existing.clicked_at || now,
            })
            .eq("resend_email_id", resendEmailId);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true, event: payload.type }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing tracking webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
