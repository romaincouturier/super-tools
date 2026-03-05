import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getSenderName, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface ReminderResult {
  entity_type: "training" | "mission";
  entity_id: string;
  entity_name: string;
  recipient_email: string;
  success: boolean;
  error?: string;
}

interface BookingReminder {
  entityType: "training" | "mission";
  entityId: string;
  entityName: string;
  recipientEmail: string;
  recipientFirstName: string;
  location: string;
  clientName: string;
  startDate: string;
  daysUntil: number;
  bookingItems: string[];
  extraHtml?: string;
}

async function sendBookingReminderEmail(
  reminder: BookingReminder,
  resendApiKey: string,
  senderFrom: string,
  bccList: string[],
  signature: string,
  template: { subject: string; html_content: string } | null,
): Promise<ReminderResult> {
  const bookingText = reminder.bookingItems.join(" et ");
  const typeLabel = reminder.entityType === "training" ? "la formation" : "la mission";

  let subject: string;
  let htmlContent: string;

  if (template) {
    const vars = {
      first_name: reminder.recipientFirstName,
      entity_type: typeLabel,
      entity_name: reminder.entityName,
      start_date: formatDate(reminder.startDate),
      location: reminder.location,
      client_name: reminder.clientName,
      booking_items: bookingText,
      days_until: String(reminder.daysUntil),
      extra_html: reminder.extraHtml || "",
    };
    subject = processTemplate(template.subject, vars, false);
    const body = processTemplate(template.html_content, vars, false);
    htmlContent = body
      .split(/\n\n+/)
      .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("") + "\n" + signature;
  } else {
    subject = `Rappel : Réservation pour ${typeLabel} "${reminder.entityName}"`;
    htmlContent = `
      <p>Bonjour ${reminder.recipientFirstName},</p>
      <p>Ceci est un rappel automatique concernant ${typeLabel} <strong>"${reminder.entityName}"</strong> prévue le <strong>${formatDate(reminder.startDate)}</strong> à <strong>${reminder.location}</strong> pour ${reminder.clientName}.</p>
      <p style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px;">
        <strong>⚠️ À réserver :</strong> ${bookingText}<br/>
        <em>${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} a lieu dans ${reminder.daysUntil} jour${reminder.daysUntil > 1 ? 's' : ''}.</em>
      </p>
      ${reminder.extraHtml || ''}
      <p>Merci de procéder à la réservation dès que possible et de cocher les cases correspondantes dans l'interface de gestion.</p>
      <p>Ce rappel sera envoyé chaque lundi jusqu'à ce que les réservations soient confirmées.</p>
      ${signature}
    `;
  }

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFrom,
        to: [reminder.recipientEmail],
        bcc: bccList,
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Resend error for ${reminder.entityType} ${reminder.entityId}:`, errorText);
      return {
        entity_type: reminder.entityType,
        entity_id: reminder.entityId,
        entity_name: reminder.entityName,
        recipient_email: reminder.recipientEmail,
        success: false,
        error: errorText,
      };
    }

    console.log(`Reminder sent for ${reminder.entityType} ${reminder.entityId} to ${reminder.recipientEmail}`);
    return {
      entity_type: reminder.entityType,
      entity_id: reminder.entityId,
      entity_name: reminder.entityName,
      recipient_email: reminder.recipientEmail,
      success: true,
    };
  } catch (error) {
    console.error(`Error sending reminder for ${reminder.entityType} ${reminder.entityId}:`, error);
    return {
      entity_type: reminder.entityType,
      entity_id: reminder.entityId,
      entity_name: reminder.entityName,
      recipient_email: reminder.recipientEmail,
      success: false,
      error: String(error),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const bccList = await getBccList();
    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();

    // Fetch booking_reminder template (use _tu since it's internal)
    const { data: bookingTemplate } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", "booking_reminder_tu")
      .maybeSingle();

    const now = new Date();
    const threeMonthsFromNow = new Date(now);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    const results: ReminderResult[] = [];

    // ─── TRAININGS ───────────────────────────────────────────────────────
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id, training_name, start_date, end_date, location, client_name,
        hotel_booked, train_booked, restaurant_booked, format_formation, session_format,
        trainer_id,
        trainers!trainings_trainer_id_fkey ( id, first_name, last_name, email )
      `)
      .eq("session_format", "presentiel")
      .gte("start_date", now.toISOString().split("T")[0])
      .lte("start_date", threeMonthsFromNow.toISOString().split("T")[0])
      .or("hotel_booked.is.null,hotel_booked.eq.false,train_booked.is.null,train_booked.eq.false,restaurant_booked.is.null,restaurant_booked.eq.false");

    if (trainingsError) {
      console.error("Error fetching trainings:", trainingsError);
      throw trainingsError;
    }

    console.log(`Found ${trainings?.length || 0} trainings requiring booking reminders`);

    for (const training of (trainings || [])) {
      const trainersData = training.trainers;
      let trainer: { id: string; first_name: string; last_name: string; email: string } | null = null;
      if (trainersData) {
        if (Array.isArray(trainersData) && trainersData.length > 0) {
          trainer = trainersData[0] as any;
        } else if (typeof trainersData === 'object' && !Array.isArray(trainersData)) {
          trainer = trainersData as typeof trainer;
        }
      }

      if (!trainer?.email) {
        results.push({
          entity_type: "training",
          entity_id: training.id,
          entity_name: training.training_name,
          recipient_email: "N/A",
          success: false,
          error: "No trainer email",
        });
        continue;
      }

      const trainingDate = new Date(training.start_date);
      const daysUntil = Math.ceil((trainingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const needsHotel = !training.hotel_booked;
      const needsTrain = !training.train_booked && daysUntil <= 60;
      const isInterEntreprise = training.format_formation === "inter-entreprises";
      const needsRestaurant = isInterEntreprise && !training.restaurant_booked && daysUntil <= 14;

      const bookingItems: string[] = [];
      if (needsTrain) bookingItems.push("le train");
      if (needsHotel) bookingItems.push("l'hôtel");
      if (needsRestaurant) bookingItems.push("le restaurant");

      if (bookingItems.length === 0) continue;

      const extraHtml = needsRestaurant ? `
        <p style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 15px; border-radius: 4px;">
          <strong>🍽️ Restaurant :</strong> Pour les formations inter-entreprises, pensez à réserver un restaurant pour le déjeuner avec les participants.
        </p>
      ` : '';

      const result = await sendBookingReminderEmail(
        {
          entityType: "training",
          entityId: training.id,
          entityName: training.training_name,
          recipientEmail: trainer.email,
          recipientFirstName: trainer.first_name,
          location: training.location,
          clientName: training.client_name,
          startDate: training.start_date,
          daysUntil,
          bookingItems,
          extraHtml,
        },
        RESEND_API_KEY,
        senderFrom,
        bccList,
        signature,
        bookingTemplate,
      );
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    // ─── MISSIONS ────────────────────────────────────────────────────────
    const { data: missions, error: missionsError } = await supabase
      .from("missions")
      .select("id, title, start_date, location, client_name, train_booked, hotel_booked, status, created_by")
      .not("location", "is", null)
      .in("status", ["not_started", "in_progress"])
      .gte("start_date", now.toISOString().split("T")[0])
      .lte("start_date", threeMonthsFromNow.toISOString().split("T")[0])
      .or("hotel_booked.is.null,hotel_booked.eq.false,train_booked.is.null,train_booked.eq.false");

    if (missionsError) {
      console.error("Error fetching missions:", missionsError);
    }

    console.log(`Found ${missions?.length || 0} missions requiring booking reminders`);

    const adminEmail = await getSenderEmail();
    const adminFullName = await getSenderName();
    const adminFirstName = adminFullName.split(" ")[0];

    for (const mission of (missions || [])) {
      if (!mission.location) continue;

      const missionDate = new Date(mission.start_date);
      const daysUntil = Math.ceil((missionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const needsHotel = !mission.hotel_booked;
      const needsTrain = !mission.train_booked && daysUntil <= 60;

      const bookingItems: string[] = [];
      if (needsTrain) bookingItems.push("le train");
      if (needsHotel) bookingItems.push("l'hôtel");

      if (bookingItems.length === 0) continue;

      const result = await sendBookingReminderEmail(
        {
          entityType: "mission",
          entityId: mission.id,
          entityName: mission.title,
          recipientEmail: adminEmail,
          recipientFirstName: adminFirstName,
          location: mission.location,
          clientName: mission.client_name || "Client",
          startDate: mission.start_date,
          daysUntil,
          bookingItems,
        },
        RESEND_API_KEY,
        senderFrom,
        bccList,
        signature,
        bookingTemplate,
      );
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    // ─── RESPONSE ────────────────────────────────────────────────────────
    const successCount = results.filter((r) => r.success).length;
    console.log(`Booking reminders sent: ${successCount}/${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: successCount,
        total: results.length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-booking-reminder:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
