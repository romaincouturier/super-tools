import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
  sendEmail,
  getSigniticSignature,
} from "../_shared/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getBccSettings } from "../_shared/bcc-settings.ts";

const VERSION = "process-crm-reminders@1.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  console.log(`[${VERSION}] Starting CRM action reminders...`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's date in YYYY-MM-DD (UTC)
    const today = new Date().toISOString().split("T")[0];
    console.log(`[${VERSION}] Checking CRM cards with actions due on: ${today}`);

    // Fetch CRM cards with waiting_next_action_date = today and sales_status OPEN
    const { data: dueCards, error: fetchError } = await supabase
      .from("crm_cards")
      .select("id, title, company, first_name, last_name, email, waiting_next_action_date, waiting_next_action_text, status_operational")
      .eq("waiting_next_action_date", today)
      .eq("sales_status", "OPEN");

    if (fetchError) {
      console.error(`[${VERSION}] Error fetching CRM cards:`, fetchError);
      throw fetchError;
    }

    if (!dueCards || dueCards.length === 0) {
      console.log(`[${VERSION}] No CRM actions due today`);
      return createJsonResponse({
        success: true,
        message: "No CRM actions due today",
        _version: VERSION,
      });
    }

    console.log(`[${VERSION}] Found ${dueCards.length} CRM card(s) with actions due today`);

    // Get signature and BCC settings
    const [signature, bccList] = await Promise.all([
      getSigniticSignature(),
      getBccSettings(supabase),
    ]);

    const recipientEmail = "romain@supertilt.fr";
    const results: { id: string; title: string; success: boolean; error?: string }[] = [];

    // Build a single digest email with all due actions
    const actionRows = dueCards.map((card) => {
      const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
      const label = card.company
        ? `(${card.company}) ${card.title}`
        : card.title;
      const actionText = card.waiting_next_action_text || "Action à réaliser";

      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${label}</strong>
            ${contactName ? `<br/><span style="color: #6b7280; font-size: 13px;">${contactName}</span>` : ""}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${actionText}</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <p>Bonjour,</p>
      <p>Tu as <strong>${dueCards.length} action${dueCards.length > 1 ? "s" : ""}</strong> CRM programmée${dueCards.length > 1 ? "s" : ""} pour aujourd'hui :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Opportunité</th>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${actionRows}
        </tbody>
      </table>
      <p style="margin: 20px 0;">
        <a href="${APP_URL}/crm" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Ouvrir le CRM
        </a>
      </p>
      ${signature}
    `;

    const emailResult = await sendEmail({
      to: [recipientEmail],
      from: "Romain Couturier <romain@supertilt.fr>",
      subject: `🔔 CRM : ${dueCards.length} action${dueCards.length > 1 ? "s" : ""} programmée${dueCards.length > 1 ? "s" : ""} aujourd'hui`,
      html: htmlContent,
      bcc: bccList,
    });

    if (!emailResult.success) {
      console.error(`[${VERSION}] Email sending failed:`, emailResult.error);
      return createErrorResponse(`Échec de l'envoi: ${emailResult.error}`, 500);
    }

    console.log(`[${VERSION}] Digest email sent successfully:`, emailResult.id);

    return createJsonResponse({
      success: true,
      cards_count: dueCards.length,
      email_id: emailResult.id,
      _version: VERSION,
    });
  } catch (error: unknown) {
    console.error(`[${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(errorMessage, 500);
  }
});
