import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
  createErrorResponse,
  sendEmail,
  escapeHtml,
  formatDateWithDayFr,
  formatTime,
  emailButton,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { logEmailActivity } from "../_shared/email-helpers.ts";

/**
 * Process Event Reminders
 *
 * Runs daily at 06:45 Paris time.
 * For each active event whose date is TODAY (J) or TOMORROW (J-1):
 *   - Sends a recap email to the assigned user (or creator as fallback)
 *   - Includes title, date/time, location/url, link back to SuperTools
 * Deduplicated via activity_logs (one send per event per kind per day).
 */

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();

    const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

    console.log(`[event-reminders] today=${todayIso} tomorrow=${tomorrowIso}`);

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .in("event_date", [todayIso, tomorrowIso])
      .eq("status", "active");

    if (error) throw error;
    if (!events || events.length === 0) {
      return createJsonResponse({ success: true, message: "No events today/tomorrow" });
    }

    const bccList = await getBccList();
    const signatureHtml = await getSigniticSignature();
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    let sent = 0;
    let skipped = 0;

    for (const event of events) {
      const isToday = event.event_date === todayIso;
      const kind = isToday ? "event_reminder_d_day_sent" : "event_reminder_d_minus_1_sent";

      // Dedup
      const { data: existing } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("action_type", kind)
        .eq("recipient_email", event.id)
        .gte("created_at", todayIso + "T00:00:00")
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Resolve recipient
      const userId = event.assigned_to || event.created_by;
      if (!userId) {
        console.log(`[event-reminders] event ${event.id} has no assignee/creator`);
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("user_id", userId)
        .single();

      if (!profile?.email) {
        console.log(`[event-reminders] no email for user ${userId}`);
        continue;
      }

      const eventDate = formatDateWithDayFr(event.event_date);
      const eventTime = event.event_time ? formatTime(event.event_time) : null;
      const greeting = profile.first_name ? `Bonjour ${escapeHtml(profile.first_name)},` : "Bonjour,";
      const intro = isToday
        ? `<strong>C'est aujourd'hui !</strong> Voici le récapitulatif de ton évènement :`
        : `<strong>C'est demain !</strong> Voici le récapitulatif de ton évènement :`;

      const isVisio = event.location_type === "visio";
      const isExternal = event.event_type === "external";

      // Location / URL block
      const locParts: string[] = [];
      if (isVisio) {
        const visioUrl = event.private_group_url || event.event_url || event.location;
        if (visioUrl && /^https?:\/\//i.test(visioUrl)) {
          locParts.push(`<p style="margin:8px 0;"><strong>Lien visio :</strong> <a href="${escapeHtml(visioUrl)}">${escapeHtml(visioUrl)}</a></p>`);
        } else if (event.location) {
          locParts.push(`<p style="margin:8px 0;"><strong>Visio :</strong> ${escapeHtml(event.location)}</p>`);
        }
      } else if (event.location) {
        locParts.push(`<p style="margin:8px 0;"><strong>Lieu :</strong> ${escapeHtml(event.location)}</p>`);
      }
      if (isExternal && event.event_url) {
        locParts.push(`<p style="margin:8px 0;"><strong>Site de l'évènement :</strong> <a href="${escapeHtml(event.event_url)}">${escapeHtml(event.event_url)}</a></p>`);
      }

      const supertoolsUrl = `${APP_URL}/events/${event.id}`;

      const subject = isToday
        ? `📅 Aujourd'hui : ${event.title}`
        : `📅 Demain : ${event.title}`;

      const html = `
<div style="font-family: Arial, sans-serif; color:#333; max-width:600px; text-align:left;">
  <p>${greeting}</p>
  <p>${intro}</p>
  <div style="background:#f6f7f9; border-left:3px solid #4f46e5; padding:12px 16px; margin:16px 0; border-radius:4px;">
    <p style="margin:0 0 8px 0; font-size:16px;"><strong>${escapeHtml(event.title)}</strong></p>
    <p style="margin:8px 0;"><strong>Date :</strong> ${escapeHtml(eventDate)}${eventTime ? ` à ${escapeHtml(eventTime)}` : ""}</p>
    ${locParts.join("\n")}
    ${event.description ? `<p style="margin:8px 0; white-space:pre-wrap;">${escapeHtml(event.description)}</p>` : ""}
  </div>
  <p style="text-align:left;">${emailButton("Ouvrir dans SuperTools", supertoolsUrl)}</p>
  ${signatureHtml}
</div>`;

      const result = await sendEmail({
        to: profile.email,
        subject,
        html,
        bcc: bccList,
      });

      if (result.success) {
        sent++;
        await logEmailActivity(supabase, kind, event.id, {
          event_title: event.title,
          recipient: profile.email,
          event_date: event.event_date,
        });
      } else {
        console.error(`[event-reminders] send failed for event ${event.id}:`, result.error);
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    return createJsonResponse({ success: true, sent, skipped, total: events.length });
  } catch (err) {
    console.error("[event-reminders] error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
