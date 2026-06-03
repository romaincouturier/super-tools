import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    // J+2 window: surveys closing in [now+24h, now+48h]
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: surveys } = await (supabase as any)
      .from("training_surveys")
      .select("id, training_id")
      .eq("is_active", true)
      .not("closes_at", "is", null)
      .gte("closes_at", in24h)
      .lte("closes_at", in48h);

    if (!surveys || surveys.length === 0) {
      return createJsonResponse({ success: true, processed: 0 });
    }

    let processed = 0;
    for (const survey of surveys) {
      // Find recipients who have no response yet and have not been reminded
      const { data: recipients } = await (supabase as any)
        .from("training_survey_recipients")
        .select("id, sent_at, last_reminded_at")
        .eq("survey_id", survey.id);

      if (!recipients || recipients.length === 0) continue;

      const { data: responses } = await (supabase as any)
        .from("training_survey_responses")
        .select("recipient_id")
        .eq("survey_id", survey.id);

      const respondedSet = new Set((responses ?? []).map((r: any) => r.recipient_id));
      const toRemind = recipients.filter(
        (r: any) => r.sent_at && !r.last_reminded_at && !respondedSet.has(r.id),
      );

      if (toRemind.length === 0) continue;

      // Trigger send-training-survey as a reminder
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-training-survey`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ surveyId: survey.id, isReminder: true }),
      });
      processed++;
    }

    return createJsonResponse({ success: true, processed });
  } catch (error) {
    console.error("training-survey-reminders error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Internal error", 500);
  }
});
