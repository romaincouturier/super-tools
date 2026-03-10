import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Format date to Google Calendar format: YYYYMMDDTHHMMSS
function formatDateForCalendar(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
}

// Generate calendar links per day for each schedule entry
function generatePerDayCalendarLinks(
  trainingName: string,
  location: string,
  startDate: string,
  endDate: string,
  schedules: Array<{ day_date: string; start_time: string; end_time: string }>,
  senderEmail: string,
  meetingUrl?: string
): Array<{ label: string; google: string; outlook: string }> {
  const meetingLine = meetingUrl ? `\n\nRejoindre la visio: ${meetingUrl}` : "";
  const description = `Formation Supertilt: ${trainingName}${meetingLine}\n\nEmail: ${senderEmail}`;
  const calLocation = meetingUrl || location || '';
  
  const sortedSchedules = schedules && schedules.length > 0
    ? [...schedules].sort((a, b) => a.day_date.localeCompare(b.day_date))
    : [{ day_date: startDate, start_time: "09:00", end_time: "17:00" }];

  return sortedSchedules.map((sched, index) => {
    const calStart = formatDateForCalendar(sched.day_date, sched.start_time);
    const calEnd = formatDateForCalendar(sched.day_date, sched.end_time);

    const d = new Date(sched.day_date + "T12:00:00");
    const dayNames = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    const label = sortedSchedules.length > 1
      ? `Jour ${index + 1} – ${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`
      : `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    const titleSuffix = sortedSchedules.length > 1 ? ` (Jour ${index + 1}/${sortedSchedules.length})` : "";

    const googleParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Formation: ${trainingName}${titleSuffix}`,
      dates: `${calStart}/${calEnd}`,
      details: description,
      location: calLocation,
      ctz: 'Europe/Paris',
    });

    const outlookStart = calStart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
    const outlookEnd = calEnd.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');

    const outlookParams = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: `Formation: ${trainingName}${titleSuffix}`,
      startdt: outlookStart,
      enddt: outlookEnd,
      body: description,
      location: calLocation,
    });

    return {
      label,
      google: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
    };
  });
}

// Generate calendar links for live meetings
function generateLiveMeetingCalendarLinks(
  liveMeetings: Array<{ title: string; scheduled_at: string; duration_minutes: number; meeting_url: string | null }>,
  senderEmail: string
): Array<{ label: string; google: string; outlook: string }> {
  return liveMeetings.map((live) => {
    const start = new Date(live.scheduled_at);
    const end = new Date(start.getTime() + live.duration_minutes * 60 * 1000);

    // Manual formatting to avoid timezone issues
    const pad = (n: number) => String(n).padStart(2, '0');
    const calStart = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
    const calEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;

    const dayNames = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    const label = `🎥 ${live.title} – ${dayNames[start.getDay()]} ${start.getDate()} ${monthNames[start.getMonth()]} à ${pad(start.getHours())}h${pad(start.getMinutes())}`;

    const description = `Live: ${live.title}${live.meeting_url ? `\n\nRejoindre: ${live.meeting_url}` : ""}\n\nEmail: ${senderEmail}`;
    const location = live.meeting_url || "En ligne";

    const googleParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Live: ${live.title}`,
      dates: `${calStart}/${calEnd}`,
      details: description,
      location,
      ctz: 'Europe/Paris',
    });

    const outlookStart = calStart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
    const outlookEnd = calEnd.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');

    const outlookParams = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: `Live: ${live.title}`,
      startdt: outlookStart,
      enddt: outlookEnd,
      body: description,
      location,
    });

    return {
      label,
      google: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionnaireId, trainingId, participantEmail, participantFirstName, formatFormation } = await req.json();

    if (!participantEmail || !trainingId) {
      return new Response(
        JSON.stringify({ error: "participantEmail and trainingId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch URLs from settings
    const { data: urlSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["youtube_url", "blog_url"]);

    const youtubeUrl = urlSettings?.find((s: any) => s.setting_key === "youtube_url")?.setting_value || "https://www.youtube.com/@supertilt";
    const blogUrl = urlSettings?.find((s: any) => s.setting_key === "blog_url")?.setting_value || "https://supertilt.fr/blog/";

    const bccList = await getBccList();

    // Fetch training info
    let trainingName = "";
    let location = "";
    let startDate = "";
    let endDate = "";
    let isOnline = formatFormation === "en_ligne" || formatFormation === "online" || formatFormation === "e_learning";

    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, format_formation, location, start_date, end_date")
      .eq("id", trainingId)
      .single();

    if (!trainingError && training) {
      trainingName = training.training_name;
      location = training.location || "";
      startDate = training.start_date;
      endDate = training.end_date || training.start_date;
      isOnline = training.format_formation === "en_ligne" ||
                 training.format_formation === "online" ||
                 training.format_formation === "e_learning" ||
                 (training.location && training.location.toLowerCase().includes("en ligne"));
    }

    // Fetch training schedules and live meetings in parallel
    const [schedulesResult, liveMeetingsResult] = await Promise.all([
      supabase
        .from("training_schedules")
        .select("day_date, start_time, end_time")
        .eq("training_id", trainingId)
        .order("day_date", { ascending: true }),
      supabase
        .from("training_live_meetings")
        .select("title, scheduled_at, duration_minutes, meeting_url, status")
        .eq("training_id", trainingId)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true }),
    ]);

    const schedules = schedulesResult.data || [];
    const liveMeetings = liveMeetingsResult.data || [];

    const senderEmail = await getSenderEmail();

    // Determine meeting URL for online trainings
    let trainingMeetingUrl = "";
    if (isOnline && liveMeetings.length > 0 && liveMeetings[0].meeting_url) {
      trainingMeetingUrl = liveMeetings[0].meeting_url;
    }
    // Fallback: if location looks like a URL, use it as meeting URL
    if (!trainingMeetingUrl && location && /^https?:\/\//i.test(location)) {
      trainingMeetingUrl = location;
    }

    // Generate calendar links for schedule days
    const calendarDays = generatePerDayCalendarLinks(
      trainingName, location, startDate, endDate, schedules, senderEmail, trainingMeetingUrl || undefined
    );

    // Generate calendar links for live meetings
    const liveCalendarDays = generateLiveMeetingCalendarLinks(liveMeetings, senderEmail);

    // Combine: schedule days + live meetings
    const allCalendarEntries = [...calendarDays, ...liveCalendarDays];

    const [signature, senderFrom] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
    ]);

    const firstName = participantFirstName || "participant";

    // Build format-specific content
    let formatSpecificContent = "";
    if (isOnline) {
      formatSpecificContent = `<p>Je te laisse continuer ton parcours de formation à partir de ton espace personnel.</p>`;
    } else {
      formatSpecificContent = `<p>Je te donne rendez-vous le jour J, ce qui te laisse le temps suffisant pour préparer toutes tes questions et libérer ton agenda pour être dédié à 100% :-)</p>
        <p>Si tu as un empêchement ou un retard pour arriver, préviens-moi, je verrai comment on peut s'adapter à cette situation :-)</p>`;
    }

    // Calendar section HTML
    const calendarRows = allCalendarEntries.map((day) => `
      <tr>
        <td style="padding: 6px 12px 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; white-space: nowrap;">${day.label}</td>
        <td style="padding: 6px 8px 6px 0;">
          <a href="${day.google}" target="_blank" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 6px 14px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 13px;">Google</a>
        </td>
        <td style="padding: 6px 0;">
          <a href="${day.outlook}" target="_blank" style="display: inline-block; background-color: #0078d4; color: #ffffff; padding: 6px 14px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 13px;">Outlook</a>
        </td>
      </tr>
    `).join("");

    const calendarSection = allCalendarEntries.length > 0 ? `
      <div style="margin: 25px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #e6bc00;">
        <p style="margin: 0 0 15px 0; font-weight: bold; color: #1a1a1a;">📅 Ajoute ${allCalendarEntries.length > 1 ? "les sessions" : "la formation"} à ton agenda :</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">${calendarRows}</table>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">Apple Calendar : ouvre le lien Google depuis Safari, puis "Ajouter à Calendrier"</p>
      </div>
    ` : "";

    // Try template
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", "questionnaire_confirmation_tu")
      .maybeSingle();

    let subject: string;
    let htmlContent: string;

    if (template) {
      const vars = {
        first_name: firstName,
        training_name: trainingName,
        format_specific_content: formatSpecificContent,
        calendar_section: calendarSection,
        youtube_url: youtubeUrl,
        blog_url: blogUrl,
        sender_email: senderEmail,
      };
      subject = processTemplate(template.subject, vars, false);
      const body = processTemplate(template.html_content, vars, false);
      htmlContent = body
        .split(/\n\n+/)
        .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("") + "\n" + signature;
    } else {
      subject = `Questionnaire complété - ${trainingName}`;
      htmlContent = `
        <p>Bonjour ${firstName},</p>
        <p>Merci d'avoir rempli le formulaire de recueil des besoins pour la formation.</p>
        ${formatSpecificContent}
        ${calendarSection}
        <p>Tu peux aussi flâner sur notre <a href="${youtubeUrl}">chaîne YouTube</a> et notre <a href="${blogUrl}">blog</a> sur lesquels tu trouveras des éléments en rapport avec le programme.</p>
        <p>Si tu as la moindre question, je reste à ta disposition par mail <a href="mailto:${senderEmail}">${senderEmail}</a></p>
        <p>À très vite,</p>
        ${signature}
      `;
    }

    // Send email via shared helper (auto-traces to sent_emails_log)
    const result = await sendEmail({
      to: [participantEmail],
      bcc: bccList,
      from: senderFrom,
      replyTo: senderEmail,
      subject,
      html: htmlContent,
      _emailType: "questionnaire_confirmation",
      _trainingId: trainingId,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log("Questionnaire confirmation email sent to:", participantEmail, result.id);

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "questionnaire_confirmation_sent",
        recipient_email: participantEmail,
        details: {
          training_id: trainingId,
          training_name: trainingName,
          questionnaire_id: questionnaireId,
          format: isOnline ? "en_ligne" : "presentiel",
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending questionnaire confirmation email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send confirmation email";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
