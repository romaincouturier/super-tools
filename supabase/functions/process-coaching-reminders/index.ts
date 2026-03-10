import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Process Coaching Reminders
 *
 * Called by cron daily. For each participant with coaching sessions:
 * 1. If training ended yesterday → schedule coaching_first_invite for tomorrow at 09:00
 * 2. Every 3 months from enrollment → schedule coaching_periodic_reminder
 * 3. 1 month before coaching_deadline → schedule coaching_final_reminder
 *
 * Only schedules emails if coaching_sessions_completed < coaching_sessions_total
 * and no duplicate email of the same type is already pending.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[process-coaching-reminders] Starting...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Get all participants with coaching sessions remaining
    const { data: participants, error } = await supabase
      .from("training_participants")
      .select(`
        id, training_id, email, first_name, coaching_sessions_total,
        coaching_sessions_completed, coaching_deadline, added_at, formula,
        trainings!inner(end_date, training_name)
      `)
      .gt("coaching_sessions_total", 0)
      .not("coaching_deadline", "is", null);

    if (error) {
      console.error("[process-coaching-reminders] Error fetching participants:", error);
      throw error;
    }

    if (!participants || participants.length === 0) {
      console.log("[process-coaching-reminders] No coaching participants found");
      return new Response(
        JSON.stringify({ success: true, message: "No coaching participants" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[process-coaching-reminders] Found ${participants.length} coaching participants`);

    let scheduled = 0;

    for (const p of participants) {
      const remaining = (p.coaching_sessions_total || 0) - (p.coaching_sessions_completed || 0);
      if (remaining <= 0) continue;

      const training = (p as any).trainings;
      if (!training) continue;

      const deadlineDate = new Date(p.coaching_deadline + "T00:00:00");
      if (deadlineDate < now) continue; // Coaching expired

      // Helper: check if email type already scheduled (pending) for this participant
      const alreadyScheduled = async (emailType: string): Promise<boolean> => {
        const { data } = await supabase
          .from("scheduled_emails")
          .select("id")
          .eq("participant_id", p.id)
          .eq("training_id", p.training_id)
          .eq("email_type", emailType)
          .in("status", ["pending", "sent"])
          .limit(1);
        return (data || []).length > 0;
      };

      // 1. First invite: schedule day after training ends
      const endDate = new Date(training.end_date + "T00:00:00");
      const dayAfterEnd = new Date(endDate);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
      const dayAfterEndStr = dayAfterEnd.toISOString().split("T")[0];

      if (dayAfterEndStr === todayStr || (dayAfterEnd < now && dayAfterEnd > new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))) {
        if (!(await alreadyScheduled("coaching_first_invite"))) {
          const sendAt = new Date(dayAfterEndStr + "T09:00:00");
          if (sendAt > now) {
            await supabase.from("scheduled_emails").insert({
              training_id: p.training_id,
              participant_id: p.id,
              email_type: "coaching_first_invite",
              scheduled_for: sendAt.toISOString(),
              status: "pending",
            });
            scheduled++;
            console.log(`[process-coaching-reminders] Scheduled first invite for ${p.email}`);
          }
        }
      }

      // 2. Periodic reminder every 3 months from enrollment
      const addedAt = new Date(p.added_at);
      const monthsSinceEnrollment = (now.getFullYear() - addedAt.getFullYear()) * 12 + (now.getMonth() - addedAt.getMonth());
      
      if (monthsSinceEnrollment > 0 && monthsSinceEnrollment % 3 === 0) {
        // Check if we're within the first 7 days of this 3-month mark
        const threeMonthMark = new Date(addedAt);
        threeMonthMark.setMonth(threeMonthMark.getMonth() + monthsSinceEnrollment);
        const daysDiff = Math.abs((now.getTime() - threeMonthMark.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) {
          if (!(await alreadyScheduled("coaching_periodic_reminder"))) {
            // Check if any periodic reminder was sent in the last 80 days
            const { data: recentReminders } = await supabase
              .from("scheduled_emails")
              .select("id")
              .eq("participant_id", p.id)
              .eq("email_type", "coaching_periodic_reminder")
              .eq("status", "sent")
              .gte("sent_at", new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000).toISOString())
              .limit(1);

            if (!recentReminders || recentReminders.length === 0) {
              await supabase.from("scheduled_emails").insert({
                training_id: p.training_id,
                participant_id: p.id,
                email_type: "coaching_periodic_reminder",
                scheduled_for: new Date(todayStr + "T09:00:00").toISOString(),
                status: "pending",
              });
              scheduled++;
              console.log(`[process-coaching-reminders] Scheduled periodic reminder for ${p.email}`);
            }
          }
        }
      }

      // 3. Final reminder: 1 month before deadline
      const oneMonthBefore = new Date(deadlineDate);
      oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
      const oneMonthBeforeStr = oneMonthBefore.toISOString().split("T")[0];
      const daysDiffFinal = Math.abs((now.getTime() - oneMonthBefore.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiffFinal <= 3 && now >= oneMonthBefore) {
        if (!(await alreadyScheduled("coaching_final_reminder"))) {
          await supabase.from("scheduled_emails").insert({
            training_id: p.training_id,
            participant_id: p.id,
            email_type: "coaching_final_reminder",
            scheduled_for: new Date(todayStr + "T09:00:00").toISOString(),
            status: "pending",
          });
          scheduled++;
          console.log(`[process-coaching-reminders] Scheduled final reminder for ${p.email}`);
        }
      }
    }

    console.log(`[process-coaching-reminders] Done. Scheduled ${scheduled} emails.`);

    return new Response(
      JSON.stringify({ success: true, scheduled }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[process-coaching-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
