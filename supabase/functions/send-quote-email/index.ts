import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";

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

    // Fetch Signitic signature
    let signature = "";
    try {
      const sigRes = await fetch("https://api.signitic.app/signatures/romain@supertilt.fr/html");
      if (sigRes.ok) signature = await sigRes.text();
    } catch {
      // ignore signature fetch errors
    }

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

    const bcc = isTest ? [] : await getBccList();

    const result = await sendEmail({
      to,
      subject,
      html,
      bcc: bcc.length > 0 ? bcc : undefined,
      _emailType: "quote_send",
    });

    if (!result.success) {
      throw new Error(result.error || "Email sending failed");
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-quote-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
