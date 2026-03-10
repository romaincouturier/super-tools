import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Process Action Reminders
 * 
 * Called daily at 7:00 AM by a cron job.
 * Scans training_actions for pending actions due today,
 * then delegates each reminder email to send-action-reminder.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-action-reminders@1.0.0";

serve(async (req) => {
  console.log(`[${VERSION}] Starting...`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format (UTC)
    const today = new Date().toISOString().split("T")[0];
    console.log(`[${VERSION}] Checking for pending actions due on: ${today}`);

    // Fetch pending actions due today that haven't received a reminder
    const { data: dueActions, error: fetchError } = await supabase
      .from("training_actions")
      .select("id, training_id, description, due_date, assigned_user_email, assigned_user_name")
      .eq("status", "pending")
      .eq("due_date", today)
      .is("reminder_sent_at", null);

    if (fetchError) {
      console.error(`[${VERSION}] Error fetching actions:`, fetchError);
      throw fetchError;
    }

    if (!dueActions || dueActions.length === 0) {
      console.log(`[${VERSION}] No pending actions due today`);
      return new Response(
        JSON.stringify({ success: true, message: "No actions due today", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Found ${dueActions.length} actions due today`);

    // Fetch training names for all unique training IDs
    const trainingIds = [...new Set(dueActions.map(a => a.training_id))];
    const { data: trainings } = await supabase
      .from("trainings")
      .select("id, training_name")
      .in("id", trainingIds);

    const trainingNameMap = new Map<string, string>();
    trainings?.forEach((t: { id: string; training_name: string }) => {
      trainingNameMap.set(t.id, t.training_name);
    });

    const sendReminderUrl = `${supabaseUrl}/functions/v1/send-action-reminder`;
    const results: { id: string; success: boolean; error?: string }[] = [];

    // Process each action sequentially with delay for rate limits
    for (const action of dueActions) {
      console.log(`[${VERSION}] Sending reminder for action ${action.id}: "${action.description}"`);

      try {
        const response = await fetch(sendReminderUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            actionId: action.id,
            trainingName: trainingNameMap.get(action.training_id) || "Formation",
            description: action.description,
            assignedEmail: action.assigned_user_email,
            assignedName: action.assigned_user_name,
            trainingId: action.training_id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${VERSION}] Failed for action ${action.id}:`, errorText);
          results.push({ id: action.id, success: false, error: errorText });
        } else {
          const result = await response.json();
          console.log(`[${VERSION}] Action ${action.id} sent:`, result);
          results.push({ id: action.id, success: true });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[${VERSION}] Error for action ${action.id}:`, errorMessage);
        results.push({ id: action.id, success: false, error: errorMessage });
      }

      // Wait 600ms between emails to respect rate limits
      if (dueActions.indexOf(action) < dueActions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[${VERSION}] Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: dueActions.length,
        sent: successCount,
        failed: failCount,
        results,
        _version: VERSION,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, _version: VERSION }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
