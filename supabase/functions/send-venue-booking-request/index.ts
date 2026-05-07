import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { format, parseISO } from "https://esm.sh/date-fns@3";
import { fr } from "https://esm.sh/date-fns@3/locale/fr";

const VERSION = "send-venue-booking-request@2026-05-07.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trainingId } = body ?? {};
    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "Missing trainingId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch training + venue
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("id, training_name, venue_id")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return new Response(
        JSON.stringify({ error: "Training not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!training.venue_id) {
      return new Response(
        JSON.stringify({ error: "Training has no venue", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: venue, error: venueError } = await supabase
      .from("training_venues")
      .select("*")
      .eq("id", training.venue_id)
      .single();

    if (venueError || !venue) {
      return new Response(
        JSON.stringify({ error: "Venue not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch schedules ordered by date
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    const vous = venue.formal_address;
    const te_vous = vous ? "vous" : "te";
    const votre_ta = vous ? "votre" : "ta";
    const bonjour = vous ? "Bonjour," : "Bonjour,";

    const roomRef = venue.room_name
      ? `la salle « ${venue.room_name} »`
      : `${votre_ta} salle`;

    // Build schedule lines
    let scheduleLinesHtml = "";
    if (schedules && schedules.length > 0) {
      const lines = schedules.map((s: any) => {
        const dateLabel = format(parseISO(s.day_date), "EEEE d MMMM yyyy", { locale: fr });
        const arrival = s.start_time
          ? (() => {
              const [h, m] = s.start_time.split(":").map(Number);
              const arrivalH = h - 1;
              return `${arrivalH}h${m === 0 ? "" : m.toString().padStart(2, "0")}`;
            })()
          : null;
        return `<li>${dateLabel} de ${s.start_time?.slice(0, 5) ?? "?"} à ${s.end_time?.slice(0, 5) ?? "?"}${arrival ? ` (arrivée prévue à ${arrival})` : ""}</li>`;
      });
      scheduleLinesHtml = `<ul style="margin: 8px 0; padding-left: 20px;">${lines.join("")}</ul>`;
    }

    const subject = `Demande de réservation de salle — ${training.training_name}`;

    const bodyHtml = `
      <p>${bonjour}</p>
      <p>Je ${vous ? "me permets de" : "me permets de"} ${vous ? "vous contacter" : "te contacter"} afin de ${vous ? "vous" : "te"} soumettre une demande de réservation de salle pour une session de formation.</p>
      <p>Nous souhaiterions réserver ${roomRef} pour la formation <strong>${training.training_name}</strong> aux dates et horaires suivants :</p>
      ${scheduleLinesHtml || "<p><em>(Dates à confirmer)</em></p>"}
      <p>Est-ce possible ? Merci beaucoup et bonne journée.</p>
    `;

    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();
    const htmlContent = wrapEmailHtml(bodyHtml, signature);

    console.log(`[${VERSION}] sending venue booking request to=${venue.email} training=${trainingId}`);

    const result = await sendEmail({
      from: senderFrom,
      to: [venue.email],
      bcc: bccList,
      subject,
      html: htmlContent,
      _emailType: "venue_booking_request",
    });

    if (!result.success) {
      console.error("sendEmail error:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record sent timestamp
    await supabase
      .from("trainings")
      .update({ venue_booking_sent_at: new Date().toISOString() })
      .eq("id", trainingId);

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-venue-booking-request:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
