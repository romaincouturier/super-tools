import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature for romain@supertilt.fr
async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");
  
  if (!signiticApiKey) {
    console.warn("SIGNITIC_API_KEY not configured, using default signature");
    return getDefaultSignature();
  }

  try {
    const response = await fetch(
      "https://api.signitic.app/signatures/romain@supertilt.fr/html",
      {
        headers: {
          "x-api-key": signiticApiKey,
        },
      }
    );

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && !htmlContent.includes("error")) {
        console.log("Signitic signature fetched successfully");
        return htmlContent;
      }
    }
    
    console.warn("Could not fetch Signitic signature:", response.status);
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}

function getDefaultSignature(): string {
  return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
    <strong>Romain Couturier</strong><br/>
    Supertilt - Formation professionnelle<br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
}

// Fetch BCC settings from app_settings
async function getBccSettings(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data: bccSettings } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["bcc_email", "bcc_enabled"]);
  
  let bccEnabled = true;
  let bccEmailValue: string | null = null;
  
  bccSettings?.forEach((s: { setting_key: string; setting_value: string | null }) => {
    if (s.setting_key === "bcc_enabled") {
      bccEnabled = s.setting_value === "true";
    }
    if (s.setting_key === "bcc_email" && s.setting_value) {
      bccEmailValue = s.setting_value;
    }
  });
  
  const bccList: string[] = [];
  if (bccEnabled && bccEmailValue) {
    bccList.push(bccEmailValue);
  }
  bccList.push("supertilt@bcc.nocrm.io");
  
  console.log("BCC settings - enabled:", bccEnabled, "email:", bccEmailValue, "final list:", bccList.join(", "));
  return bccList;
}

// Format date to Google Calendar format: YYYYMMDDTHHMMSS
function formatDateForCalendar(dateStr: string, timeStr: string): string {
  const date = new Date(dateStr);
  const [hours, minutes] = timeStr.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}T${hour}${minute}00`;
}

// Generate calendar links for the training event
function generateCalendarLinks(
  trainingName: string,
  location: string,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  isMultiDay: boolean,
  schedules: Array<{ day_date: string; start_time: string; end_time: string }>
): { google: string; outlook: string } {
  const description = `Formation Supertilt: ${trainingName}\n\nContact: Romain Couturier\nTéléphone: 06 66 98 76 35\nEmail: romain@supertilt.fr`;
  
  let calendarStart: string;
  let calendarEnd: string;
  
  if (schedules && schedules.length > 0) {
    // Use first schedule for start time
    const firstSchedule = schedules.sort((a, b) => 
      new Date(a.day_date).getTime() - new Date(b.day_date).getTime()
    )[0];
    const lastSchedule = schedules[schedules.length - 1];
    
    calendarStart = formatDateForCalendar(firstSchedule.day_date, firstSchedule.start_time);
    calendarEnd = formatDateForCalendar(lastSchedule.day_date, lastSchedule.end_time);
  } else {
    // Fallback to training dates with default times
    calendarStart = formatDateForCalendar(startDate, startTime || "09:00");
    calendarEnd = formatDateForCalendar(endDate || startDate, endTime || "17:00");
  }
  
  // Google Calendar link
  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Formation: ${trainingName}`,
    dates: `${calendarStart}/${calendarEnd}`,
    details: description,
    location: location || '',
    ctz: 'Europe/Paris',
  });
  const googleUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;
  
  // Outlook.com link
  const outlookStart = calendarStart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
  const outlookEnd = calendarEnd.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
  
  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `Formation: ${trainingName}`,
    startdt: outlookStart,
    enddt: outlookEnd,
    body: description,
    location: location || '',
  });
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;
  
  return { google: googleUrl, outlook: outlookUrl };
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

    // Fetch BCC settings
    const bccList = await getBccSettings(supabase);

    // Fetch training info
    let trainingName = "";
    let location = "";
    let startDate = "";
    let endDate = "";
    let isOnline = formatFormation === "en_ligne" || formatFormation === "online";
    
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
                 (training.location && training.location.toLowerCase().includes("en ligne"));
    }

    // Fetch training schedules for accurate times
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Generate calendar links
    const calendarLinks = generateCalendarLinks(
      trainingName,
      location,
      startDate,
      endDate,
      "09:00",
      "17:00",
      startDate !== endDate,
      schedules || []
    );

    // Get signature
    const signature = await getSigniticSignature();

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

    // Calendar section HTML - styled for email clients
    const calendarSection = `
      <div style="margin: 25px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #e6bc00;">
        <p style="margin: 0 0 15px 0; font-weight: bold; color: #1a1a1a;">📅 Ajoute la formation à ton agenda :</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding-right: 10px;">
              <a href="${calendarLinks.google}" target="_blank" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                📅 Google Agenda
              </a>
            </td>
            <td>
              <a href="${calendarLinks.outlook}" target="_blank" style="display: inline-block; background-color: #0078d4; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                📅 Outlook
              </a>
            </td>
          </tr>
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
      
      <p>Tu peux aussi flâner sur notre <a href="https://www.youtube.com/c/SuperTilt">chaîne YouTube</a> et notre <a href="https://supertilt.fr/blog/">blog</a> sur lesquels tu trouveras des éléments en rapport avec le programme.</p>
      
      <p>Si tu as la moindre question, je reste à ta disposition par téléphone : <strong>06 66 98 76 35</strong> ou par mail <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a></p>
      
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
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [participantEmail],
        bcc: bccList,
        subject: `Questionnaire complété - ${trainingName}`,
        html: htmlContent,
        reply_to: "romain@supertilt.fr",
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
