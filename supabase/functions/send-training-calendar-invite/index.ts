import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { formatDateWithDayFr } from "../_shared/date-utils.ts";

interface TrainingSchedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface RequestBody {
  trainingId: string;
  trainingName: string;
  clientName: string;
  location: string;
  meetingUrl?: string;
  schedules: TrainingSchedule[];
  trainerEmail: string;
  trainerFirstName: string;
  trainerLastName: string;
}

// Generate ICS file content for training sessions
function generateICS(
  trainingName: string,
  clientName: string,
  location: string,
  schedules: TrainingSchedule[],
  trainerEmail: string,
  organizerEmail: string,
  meetingUrl?: string,
  summaryUrl?: string
): string {
  const uid = crypto.randomUUID();
  const now = new Date();
  const dtstamp = formatICSDate(now);

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Supertilt//Super-Tools//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

  schedules.forEach((schedule, index) => {
    // Use local time components directly — day_date is "YYYY-MM-DD", start_time is "HH:MM"
    const [sH, sM] = schedule.start_time.split(":").map(Number);
    const [eH, eM] = schedule.end_time.split(":").map(Number);
    const [year, month, day] = schedule.day_date.split("-");
    const dtStart = `${year}${month}${day}T${String(sH).padStart(2,'0')}${String(sM).padStart(2,'0')}00`;
    const dtEnd = `${year}${month}${day}T${String(eH).padStart(2,'0')}${String(eM).padStart(2,'0')}00`;

    icsContent += `BEGIN:VEVENT
UID:${uid}-${index}@supertilt.fr
DTSTAMP:${dtstamp}
DTSTART;TZID=Europe/Paris:${dtStart}
DTEND;TZID=Europe/Paris:${dtEnd}
SUMMARY:Formation: ${escapeICS(trainingName)} - ${escapeICS(clientName)}
DESCRIPTION:Formation pour ${escapeICS(clientName)}${meetingUrl ? `\\n\\nRejoindre la visio: ${escapeICS(meetingUrl)}` : ""}${summaryUrl ? `\\n\\nInfos & documents: ${escapeICS(summaryUrl)}` : ""}\\n\\nFormateur: Vous etes le formateur de cette session.
LOCATION:${escapeICS(meetingUrl || location)}
ORGANIZER;CN=Supertilt:mailto:${organizerEmail}
ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${escapeICS(trainerEmail)}:mailto:${trainerEmail}
STATUS:CONFIRMED
END:VEVENT
`;
  });

  icsContent += `END:VCALENDAR`;

  return icsContent;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatICSDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}00`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}


serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log("Received request:", JSON.stringify(body));

    const {
      trainingId,
      trainingName,
      clientName,
      location,
      meetingUrl,
      schedules,
      trainerEmail,
      trainerFirstName,
      trainerLastName,
    } = body;

    if (!trainerEmail || !trainingName || !schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urls = await getAppUrls();
    const appUrl = urls.app_url;

    // Fetch email settings, signature, and generate ICS in parallel
    const [organizerEmail, senderFrom, bccList, emailSignature] = await Promise.all([
      getSenderEmail(),
      getSenderFrom(),
      getBccList(),
      getSigniticSignature(),
    ]);

    const summaryUrl = `${appUrl}/formation-info/${trainingId}`;

    const icsContent = generateICS(
      trainingName,
      clientName,
      location,
      schedules,
      trainerEmail,
      organizerEmail,
      meetingUrl,
      summaryUrl
    );

    // Build schedule list for email
    const scheduleList = schedules
      .map((s) => {
        const date = formatDateWithDayFr(s.day_date);
        return `<li><strong>${date}</strong> : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</li>`;
      })
      .join("");

    // Build email HTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
        <p>Bonjour ${trainerFirstName},</p>

        <p>Une nouvelle formation vient d'etre creee et vous avez ete designe(e) comme formateur(trice) :</p>

        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">${trainingName}</h3>
          <p style="margin: 0 0 8px 0;"><strong>Client :</strong> ${clientName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Lieu :</strong> ${location}</p>
          <p style="margin: 0 0 4px 0;"><strong>Planning :</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            ${scheduleList}
          </ul>
        </div>

        <p>Vous trouverez en piece jointe un fichier <strong>.ics</strong> que vous pouvez ouvrir pour ajouter cette formation directement a votre agenda (Outlook, Google Calendar, Apple Calendar, etc.).</p>

        ${emailButton("Voir les details de la formation", `${appUrl}/formations/${trainingId}`)}

        ${emailSignature}
      </div>
    `;

    // Encode ICS file for attachment
    const icsBase64 = base64Encode(icsContent);

    // Send email with ICS attachment
    const emailResponse = await sendEmail({
      from: senderFrom,
      to: [trainerEmail],
      bcc: bccList,
      subject: `Nouvelle formation : ${trainingName} - ${clientName}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Formation_${trainingName.replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
          content: icsBase64,
        },
      ],
      _emailType: "training_calendar_invite",
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email envoye a ${trainerEmail}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
