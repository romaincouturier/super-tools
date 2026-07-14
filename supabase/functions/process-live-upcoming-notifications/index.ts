import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

/**
 * Process Live Upcoming Notifications
 *
 * Runs daily via cron. For each live meeting (training_live_meetings) scheduled
 * exactly 3 days from now (Europe/Paris), creates an in-app notification
 * ("Prochain live - <jour>. JJ.MM.AA") for every participant of the training.
 *
 * Idempotent: the unique index (learner_email, reference_id, type) + upsert
 * with ignoreDuplicates prevents duplicates on reruns.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const supabase = getSupabaseClient();

    // Target day = today + 3 days, in Europe/Paris.
    const now = new Date();
    const target = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const targetDay = target.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // YYYY-MM-DD
    console.log(`[process-live-upcoming-notifications] Lives scheduled on ${targetDay}`);

    const { data: liveMeetings, error: livesError } = await supabase
      .from("training_live_meetings")
      .select("id, title, scheduled_at, training_id")
      .gte("scheduled_at", targetDay + "T00:00:00+00:00")
      .lte("scheduled_at", targetDay + "T23:59:59+00:00")
      .neq("status", "cancelled");

    if (livesError) throw livesError;

    if (!liveMeetings || liveMeetings.length === 0) {
      console.log("[process-live-upcoming-notifications] No lives in 3 days");
      return new Response(
        JSON.stringify({ success: true, message: "No live meetings in 3 days" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalCreated = 0;

    for (const live of liveMeetings) {
      const { data: participants } = await supabase
        .from("training_participants")
        .select("email")
        .eq("training_id", live.training_id);

      const emails = [
        ...new Set(
          (participants || [])
            .map((p: { email: string | null }) => (p.email || "").trim().toLowerCase())
            .filter((e: string) => e.length > 0),
        ),
      ];

      if (emails.length === 0) continue;

      const liveDate = new Date(live.scheduled_at);
      // "mer. 25.06.26"
      const weekday = liveDate.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short" });
      const shortDate = liveDate.toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
      const liveTime = liveDate.toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      });
      const liveTitle = live.title || "Live collectif";

      const rows = emails.map((email) => ({
        learner_email: email,
        type: "live_upcoming",
        title: `Prochain live - ${weekday} ${shortDate}`,
        body: `"${liveTitle}" est prevu le ${weekday} ${shortDate} a ${liveTime}.`,
        reference_id: live.id,
      }));

      const { error: insertError, count } = await supabase
        .from("learner_notifications")
        .upsert(rows, { onConflict: "learner_email,reference_id,type", ignoreDuplicates: true, count: "exact" });

      if (insertError) {
        console.error(`[process-live-upcoming-notifications] insert failed for live ${live.id}:`, insertError);
        continue;
      }
      totalCreated += count ?? 0;
    }

    console.log(`[process-live-upcoming-notifications] Done. Created ${totalCreated} notification(s).`);

    return new Response(
      JSON.stringify({ success: true, lives_processed: liveMeetings.length, notifications_created: totalCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[process-live-upcoming-notifications] Error:", error);
    await reportEdgeError(error, { fn: "process-live-upcoming-notifications" });
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
