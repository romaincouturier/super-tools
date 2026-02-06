import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  sendEmail,
  getSigniticSignature,
  escapeHtml,
  formatDateWithDayFr,
  formatTime,
} from "../_shared/mod.ts";

interface ShareEventRequest {
  event_id: string;
  recipient_email: string;
  recipient_name?: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth verification (inline, no shared helper) ──
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("Missing or malformed Authorization header");
      return createErrorResponse("Non autorisé", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user token via Auth API directly (avoids supabase-js getUser quirks in Deno)
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceKey,
      },
    });

    if (!authResponse.ok) {
      console.warn("Auth verification failed:", authResponse.status);
      return createErrorResponse("Non autorisé", 401);
    }

    const user = await authResponse.json();
    if (!user?.id) {
      console.warn("Auth verification failed: no user id");
      return createErrorResponse("Non autorisé", 401);
    }

    console.log("Authenticated user:", user.id);

    // ── Parse request body ──
    const { event_id, recipient_email, recipient_name } = await req.json() as ShareEventRequest;

    if (!event_id || !recipient_email) {
      return createErrorResponse("event_id et recipient_email sont requis", 400);
    }

    // Use service role client for data queries
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return createErrorResponse("Événement introuvable", 404);
    }

    // Fetch event media (images only)
    const { data: mediaItems } = await supabase
      .from("event_media")
      .select("*")
      .eq("event_id", event_id)
      .eq("file_type", "image")
      .order("position", { ascending: true })
      .limit(10);

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, display_name, email")
      .eq("user_id", user.id)
      .single();

    const senderName = senderProfile?.first_name && senderProfile?.last_name
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : senderProfile?.display_name || user.email || "Un collaborateur";

    // Format event date
    const eventDate = formatDateWithDayFr(event.event_date);
    const eventTime = event.event_time ? formatTime(event.event_time) : null;

    // Build event link
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
    const eventLink = `${appUrl}/events/${event_id}`;

    // Build image previews HTML
    let imagesHtml = "";
    if (mediaItems && mediaItems.length > 0) {
      const imageCards = mediaItems.map((img: any) => `
        <div style="display: inline-block; margin: 4px;">
          <img
            src="${escapeHtml(img.file_url)}"
            alt="${escapeHtml(img.file_name)}"
            style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;"
          />
        </div>
      `).join("");

      imagesHtml = `
        <div style="margin: 20px 0;">
          <p style="font-weight: 600; margin-bottom: 10px; color: #333;">📸 Aperçu des photos</p>
          <div style="text-align: left;">
            ${imageCards}
          </div>
        </div>
      `;
    }

    // Location info
    const locationLabel = event.location_type === "visio" ? "📹 Visioconférence" : "📍 Lieu";
    const locationHtml = event.location
      ? `<p style="margin: 4px 0; color: #555;">${locationLabel} : ${escapeHtml(event.location)}</p>`
      : "";

    // Description
    const descriptionHtml = event.description
      ? `<p style="margin: 10px 0; color: #555; white-space: pre-wrap;">${escapeHtml(event.description)}</p>`
      : "";

    // Get Signitic signature
    const emailSignature = await getSigniticSignature();

    const greeting = recipient_name ? `Bonjour ${escapeHtml(recipient_name)},` : "Bonjour,";

    const completeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; padding: 20px;">
    <p style="margin: 0 0 10px 0;">${greeting}</p>

    <p style="margin: 0 0 16px 0;">
      ${escapeHtml(senderName)} souhaite partager un événement avec toi :
    </p>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 12px 0; color: #111; font-size: 18px;">
        🎉 ${escapeHtml(event.title)}
      </h2>
      <p style="margin: 4px 0; color: #555;">
        📅 ${eventDate}${eventTime ? ` à ${eventTime}` : ""}
      </p>
      ${locationHtml}
      ${descriptionHtml}
    </div>

    ${imagesHtml}

    <div style="margin: 24px 0; text-align: left;">
      <a
        href="${eventLink}"
        style="display: inline-block; background-color: #e6bc00; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;"
      >
        Voir l'événement →
      </a>
    </div>

    <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
      Cet email a été envoyé depuis SuperTools.
    </p>

    <div style="margin-top: 20px;">
      ${emailSignature}
    </div>
  </div>
</body>
</html>
    `;

    const emailResult = await sendEmail({
      to: [recipient_email],
      from: `Romain Couturier <romain@supertilt.fr>`,
      subject: `📌 Événement partagé : ${event.title}`,
      html: completeHtml,
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return createErrorResponse(`Échec de l'envoi: ${emailResult.error}`, 500);
    }

    console.log("Event share email sent:", emailResult.id, "to:", recipient_email);

    return createJsonResponse({
      success: true,
      message: "Email envoyé avec succès",
      email_id: emailResult.id,
    });
  } catch (error: unknown) {
    console.error("Error in send-event-share-email:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
