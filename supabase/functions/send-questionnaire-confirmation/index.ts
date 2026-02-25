import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Format date to Google Calendar format: YYYYMMDDTHHMMSS
function formatDateForCalendar(dateStr: string, timeStr: string): string {
  // Parse date string directly to avoid timezone issues with new Date()
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
  senderEmail: string
): Array<{ label: string; google: string; outlook: string }> {
  const description = `Formation Supertilt: ${trainingName}\n\nEmail: ${senderEmail}`;
  
  const sortedSchedules = schedules && schedules.length > 0
    ? [...schedules].sort((a, b) => a.day_date.localeCompare(b.day_date))
    : [{ day_date: startDate, start_time: "09:00", end_time: "17:00" }];

  return sortedSchedules.map((sched, index) => {
    const calStart = formatDateForCalendar(sched.day_date, sched.start_time);
    const calEnd = formatDateForCalendar(sched.day_date, sched.end_time);

    // Format label like "Jour 1 – lun. 16 mars"
    const d = new Date(sched.day_date + "T12:00:00"); // noon to avoid TZ shift
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
      location: location || '',
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
      location: location || '',
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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
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

    // Fetch BCC settings
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

    // Fetch training schedules for accurate times
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Generate per-day calendar links
    // Get sender email first so we can pass it to calendar link generator
    const senderEmail = await getSenderEmail();

    const calendarDays = generatePerDayCalendarLinks(
      trainingName,
      location,
      startDate,
      endDate,
      schedules || [],
      senderEmail
    );

    // Get signature and sender info
    const [signature, senderFrom] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
    ]);

    const firstName = participantFirstName || "participant";

    // Build email content based on format
    let formatSpecificContent = "";
    
    if (isOnline) {
      formatSpecificContent = `
        <p>Je te laisse continuer ton parcours de formation à partir de ton espace personnel.</p>
      `;
    } else {
      formatSpecificContent = `
        <p>Je te donne rendez-vous le jour J, ce qui te laisse le temps suffisant pour préparer toutes tes questions et libérer ton agenda pour être dédié à 100% :-)</p>
        <p>Si tu as un empêchement ou un retard pour arriver, préviens-moi, je verrai comment on peut s'adapter à cette situation :-)</p>
      `;
    }

    // Calendar section HTML - one row per day
    const calendarRows = calendarDays.map((day) => `
      <tr>
        <td style="padding: 6px 12px 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; white-space: nowrap;">
          ${day.label}
        </td>
        <td style="padding: 6px 8px 6px 0;">
          <a href="${day.google}" target="_blank" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 6px 14px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 13px;">
            Google
          </a>
        </td>
        <td style="padding: 6px 0;">
          <a href="${day.outlook}" target="_blank" style="display: inline-block; background-color: #0078d4; color: #ffffff; padding: 6px 14px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 13px;">
            Outlook
          </a>
        </td>
      </tr>
    `).join("");

    const calendarSection = `
      <div style="margin: 25px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #e6bc00;">
        <p style="margin: 0 0 15px 0; font-weight: bold; color: #1a1a1a;">📅 Ajoute la formation à ton agenda :</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          ${calendarRows}
        </table>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">
          Apple Calendar : ouvre le lien Google depuis Safari, puis "Ajouter à Calendrier"
        </p>
      </div>
    `;

    const htmlContent = `
      <p>Bonjour ${firstName},</p>
      
      <p>Merci d'avoir rempli le formulaire de recueil des besoins pour la formation.</p>
      
      ${formatSpecificContent}
      
      ${calendarSection}
      
      <p>Tu peux aussi flâner sur notre <a href="${youtubeUrl}">chaîne YouTube</a> et notre <a href="${blogUrl}">blog</a> sur lesquels tu trouveras des éléments en rapport avec le programme.</p>
      
      <p>Si tu as la moindre question, je reste à ta disposition par mail <a href="mailto:${senderEmail}">${senderEmail}</a></p>
      
      <p>À très vite,</p>
      
      ${signature}
    `;

    // Send email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFrom,
        to: [participantEmail],
        bcc: bccList,
        subject: `Questionnaire complété - ${trainingName}`,
        html: htmlContent,
        reply_to: senderEmail,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log("Questionnaire confirmation email sent to:", participantEmail, result);

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
