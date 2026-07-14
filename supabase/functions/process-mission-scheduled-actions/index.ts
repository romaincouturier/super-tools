import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

/**
 * Process Mission Scheduled Actions
 *
 * Daily cron (07h00 Paris). For every mission whose
 * `waiting_next_action_date` is today (Europe/Paris), insert a
 * mission_activities row (duration = 0, billable = null) carrying the
 * scheduled text, then clear the scheduled fields so the action shows
 * up natively in the activity log.
 *
 * Idempotent: skips missions that already have an activity for today
 * matching the same description.
 */

const VERSION = "process-mission-scheduled-actions@1.0.0";

function todayInParis(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); // YYYY-MM-DD
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  console.log(`[${VERSION}] starting`);

  try {
    const supabase = getSupabaseClient();
    const today = todayInParis();
    console.log(`[${VERSION}] today (Paris) = ${today}`);

    const { data: missions, error: fetchError } = await supabase
      .from("missions")
      .select("id, title, waiting_next_action_text")
      .eq("waiting_next_action_date", today)
      .not("waiting_next_action_text", "is", null);

    if (fetchError) throw fetchError;

    if (!missions || missions.length === 0) {
      console.log(`[${VERSION}] no scheduled mission actions due today`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, _version: VERSION }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[${VERSION}] ${missions.length} mission(s) with action due today`);

    const results: { id: string; status: string; error?: string }[] = [];

    for (const mission of missions) {
      const description = (mission.waiting_next_action_text || "").trim();
      if (!description) {
        results.push({ id: mission.id, status: "skipped_empty" });
        continue;
      }

      try {
        // Idempotency: skip if an activity for that day with the same description already exists.
        const { data: existing } = await supabase
          .from("mission_activities")
          .select("id")
          .eq("mission_id", mission.id)
          .eq("activity_date", today)
          .eq("description", description)
          .limit(1);

        if (existing && existing.length > 0) {
          // Still clear the scheduled fields so the mission card stops
          // surfacing it as a pending scheduled action.
          await supabase
            .from("missions")
            .update({ waiting_next_action_date: null, waiting_next_action_text: null })
            .eq("id", mission.id);
          results.push({ id: mission.id, status: "already_present" });
          continue;
        }

        const { error: insertError } = await supabase.from("mission_activities").insert({
          mission_id: mission.id,
          description,
          activity_date: today,
          duration_type: "hours",
          duration: 0,
          billable_amount: null,
          invoice_url: null,
          invoice_number: null,
          is_billed: false,
          notes: null,
          google_event_id: null,
          google_event_link: null,
        });

        if (insertError) throw insertError;

        await supabase
          .from("missions")
          .update({ waiting_next_action_date: null, waiting_next_action_text: null })
          .eq("id", mission.id);

        results.push({ id: mission.id, status: "created" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${VERSION}] failed for mission ${mission.id}:`, msg);
        await reportEdgeError(err, { fn: "process-mission-scheduled-actions", itemId: mission.id });
        results.push({ id: mission.id, status: "error", error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results, _version: VERSION }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${VERSION}] fatal:`, msg);
    await reportEdgeError(err, { fn: "process-mission-scheduled-actions" });
    return new Response(
      JSON.stringify({ success: false, error: msg, _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
