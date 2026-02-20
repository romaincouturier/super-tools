import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody } from "../_shared/validation.ts";

interface TrainingSchedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

const trainingScheduleSchema = z.object({
  day_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
});

const requestSchema = z.object({
  trainingId: z.string().uuid(),
  trainingName: z.string().min(1),
  clientName: z.string().min(1),
  location: z.string().min(1),
  schedules: z.array(trainingScheduleSchema).min(1),
  trainerEmail: z.string().email(),
  trainerFirstName: z.string().min(1),
  trainerLastName: z.string().min(1),
});

// Generate ICS file content for training sessions
function generateICS(
  trainingName: string,
  clientName: string,
  location: string,
  schedules: TrainingSchedule[],
  trainerEmail: string,
  organizerEmail: string
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
    const startDate = new Date(`${schedule.day_date}T${schedule.start_time}`);
    const endDate = new Date(`${schedule.day_date}T${schedule.end_time}`);

    icsContent += `BEGIN:VEVENT
UID:${uid}-${index}@supertilt.fr
DTSTAMP:${dtstamp}
DTSTART:${formatICSDateTime(startDate)}
DTEND:${formatICSDateTime(endDate)}
SUMMARY:Formation: ${escapeICS(trainingName)} - ${escapeICS(clientName)}
DESCRIPTION:Formation pour ${escapeICS(clientName)}\\n\\nFormateur: Vous etes le formateur de cette session.
LOCATION:${escapeICS(location)}
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

// Format dates for email display
function formatDateFrench(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { data, error: validationError } = await parseBody(req, requestSchema);
    if (validationError) return validationError;

    console.log("Received request:", JSON.stringify(data));

    const {
      trainingId,
      trainingName,
      clientName,
      location,
      schedules,
      trainerEmail,
      trainerFirstName,
      trainerLastName,
    } = data;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const resend = new Resend(resendApiKey);
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";

    // Fetch email settings, signature, and generate ICS in parallel
    const [organizerEmail, senderFrom, bccList, emailSignature] = await Promise.all([
      getSenderEmail(),
      getSenderFrom(),
      getBccList(),
      getSigniticSignature(),
    ]);

    const icsContent = generateICS(
      trainingName,
      clientName,
      location,
      schedules,
      trainerEmail,
      organizerEmail
    );

    // Build schedule list for email
    const scheduleList = schedules
      .map((s) => {
        const date = formatDateFrench(s.day_date);
        return `<li><strong>${date}</strong> : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</li>`;
      })
      .join("");

    // Build email HTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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

        <p style="margin-top: 24px;">
          <a href="${appUrl}/formations/${trainingId}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Voir les details de la formation
          </a>
        </p>

        ${emailSignature}
      </div>
    `;

    // Encode ICS file for attachment
    const icsBase64 = base64Encode(icsContent);

    // Send email with ICS attachment
    const emailResponse = await resend.emails.send({
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
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email envoye a ${trainerEmail}`,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
