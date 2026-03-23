import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * Process Scheduled Emails
 * 
 * This function is called by a cron job every 15 minutes to process
 * pending emails from the scheduled_emails queue.
 * 
 * It delegates the actual email sending to the force-send-scheduled-email function
 * which handles all email types.
 */

const FUNCTION_VERSION = "1.0.0";

serve(async (req) => {
  console.log(`[process-scheduled-emails v${FUNCTION_VERSION}] Starting...`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending emails that are due (scheduled_for <= now)
    const now = new Date().toISOString();
    console.log(`[process-scheduled-emails] Checking for pending emails due before: ${now}`);

    const { data: pendingEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("id, email_type, scheduled_for, participant_id, training_id")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process max 50 emails per run to avoid timeout

    if (fetchError) {
      console.error("[process-scheduled-emails] Error fetching pending emails:", fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("[process-scheduled-emails] No pending emails to process");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending emails to process",
          _version: FUNCTION_VERSION
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[process-scheduled-emails] Found ${pendingEmails.length} pending emails to process`);

    const results: { id: string; success: boolean; error?: string }[] = [];
    const forceSendUrl = `${supabaseUrl}/functions/v1/force-send-scheduled-email`;

    // Process emails sequentially with a delay to respect rate limits
    for (const email of pendingEmails) {
      console.log(`[process-scheduled-emails] Processing email ${email.id} (${email.email_type})`);

      try {
        const response = await fetch(forceSendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ scheduledEmailId: email.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[process-scheduled-emails] Failed to process email ${email.id}:`, errorText);
          results.push({ id: email.id, success: false, error: errorText });
        } else {
          const result = await response.json();
          console.log(`[process-scheduled-emails] Email ${email.id} processed:`, result);
          results.push({ id: email.id, success: true });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[process-scheduled-emails] Error processing email ${email.id}:`, errorMessage);
        results.push({ id: email.id, success: false, error: errorMessage });
      }

      // Wait 600ms between emails to respect Resend rate limits
      if (pendingEmails.indexOf(email) < pendingEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[process-scheduled-emails] Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingEmails.length,
        sent: successCount,
        failed: failCount,
        results,
        _version: FUNCTION_VERSION
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("[process-scheduled-emails] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        _version: FUNCTION_VERSION
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
