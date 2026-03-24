import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  sendEmail,
  getSigniticSignature,
  escapeHtml,
  formatDateWithDayFr,
  formatTime,
  emailButton,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";

interface UpdateNotifyRequest {
  event_id: string;
  changes: Record<string, { old: string | null; new: string | null }>;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  event_date: "Date",
  event_time: "Heure",
  location: "Lieu",
  location_type: "Type de lieu",
  event_type: "Type d'événement",
  cfp_deadline: "Date limite CFP",
  event_url: "Lien événement",
  cfp_url: "Lien CFP",
  status: "Statut",
};

function formatValue(field: string, value: string | null): string {
  if (!value) return "—";
  if (field === "event_date") return formatDateWithDayFr(value);
  if (field === "event_time") return formatTime(value);
  if (field === "location_type") return value === "visio" ? "Visioconférence" : "Présentiel";
  if (field === "event_type") return value === "external" ? "Externe" : "Interne";
  if (field === "status") return value === "cancelled" ? "Annulé" : "Actif";
  return value;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse("Non autorisé", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user?.id) return createErrorResponse("Non autorisé", 401);

    const { event_id, changes } = await req.json() as UpdateNotifyRequest;
    if (!event_id || !changes || Object.keys(changes).length === 0) {
      return createErrorResponse("event_id et changes sont requis", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events").select("*").eq("id", event_id).single();
    if (eventError || !event) return createErrorResponse("Événement introuvable", 404);

    // Fetch shared recipients
    const { data: shares } = await supabase
      .from("event_shares").select("recipient_email, recipient_name").eq("event_id", event_id);

    if (!shares || shares.length === 0) {
      return createJsonResponse({ success: true, message: "Aucun destinataire", sent: 0 });
    }

    // Get sender info
    const { data: senderProfile } = await supabase
      .from("profiles").select("first_name, last_name, display_name, email")
      .eq("user_id", user.id).single();
    const senderName = senderProfile?.first_name && senderProfile?.last_name
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : senderProfile?.display_name || user.email || "Un collaborateur";

    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
    const eventLink = `${appUrl}/events/${event_id}`;
    const emailSignature = await getSigniticSignature();
    const bccList = await getBccList();

    // Build changes table
    const changesRows = Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => {
      const label = FIELD_LABELS[field] || field;
      return `
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #333; border-bottom: 1px solid #e5e7eb; white-space: nowrap;">${escapeHtml(label)}</td>
          <td style="padding: 8px 12px; color: #999; border-bottom: 1px solid #e5e7eb; text-decoration: line-through;">${escapeHtml(formatValue(field, oldVal))}</td>
          <td style="padding: 8px 12px; color: #111; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${escapeHtml(formatValue(field, newVal))}</td>
        </tr>`;
    }).join("");

    let sent = 0;
    for (const share of shares) {
      const greeting = share.recipient_name
        ? `Bonjour ${escapeHtml(share.recipient_name)},`
        : "Bonjour,";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; padding: 20px;">
    <p style="margin: 0 0 10px 0;">${greeting}</p>
    <p style="margin: 0 0 16px 0;">
      ${escapeHtml(senderName)} a modifié l'événement <strong>${escapeHtml(event.title)}</strong> qui avait été partagé avec toi. Voici ce qui a changé :
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Champ</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Avant</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Après</th>
        </tr>
      </thead>
      <tbody>
        ${changesRows}
      </tbody>
    </table>

    ${emailButton("Voir l'événement →", eventLink)}

    <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
      Cet email a été envoyé depuis SuperTools.
    </p>

    <div style="margin-top: 20px;">${emailSignature}</div>
  </div>
</body>
</html>`;

      const result = await sendEmail({
        to: [share.recipient_email],
        subject: `🔄 Événement modifié : ${event.title}`,
        html,
        bcc: bccList,
      });

      if (result.success) sent++;
      else console.error(`Failed to send to ${share.recipient_email}:`, result.error);
    }

    return createJsonResponse({ success: true, sent, total: shares.length });
  } catch (error: unknown) {
    console.error("Error in send-event-update-email:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
