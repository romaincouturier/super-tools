import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, emailSuccessBox, wrapEmailHtml } from "../_shared/templates.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const VERSION = "send-support-notification@2026-04-27.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type } = body ?? {};

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    // ── New ticket notification (to admin) ──
    if (type === "new_ticket") {
      const { ticketNumber, ticketTitle, ticketType, ticketPriority, description, submittedByEmail } = body;

      if (!ticketNumber || !ticketTitle) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for new_ticket", _version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminEmail = await getSenderEmail();
      const typeLabel = ticketType === "bug" ? "🐛 Bug" : "💡 Évolution";
      const priorityLabels: Record<string, string> = { critical: "🔴 Critique", high: "🟠 Haute", medium: "🟡 Moyenne", low: "🟢 Basse" };
      const prioLabel = priorityLabels[ticketPriority] || ticketPriority || "Non définie";

      console.log(`[${VERSION}] new ticket notification to=${adminEmail} ticket=${ticketNumber}`);

      const subject = `🎫 Nouveau ticket ${ticketNumber} — ${ticketTitle}`;

      const bodyHtml = `
        <p>Un nouveau ticket de support a été soumis.</p>
        ${emailInfoBox(`<strong>${ticketNumber} — ${ticketTitle}</strong>`)}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;color:#666;">Type</td><td style="padding:6px 12px;font-weight:600;">${typeLabel}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;">Priorité</td><td style="padding:6px 12px;font-weight:600;">${prioLabel}</td></tr>
          ${submittedByEmail ? `<tr><td style="padding:6px 12px;color:#666;">Soumis par</td><td style="padding:6px 12px;">${submittedByEmail}</td></tr>` : ""}
        </table>
        ${description ? `<p style="background:#f8f9fa;padding:12px;border-radius:8px;color:#333;">${description.slice(0, 500)}${description.length > 500 ? "…" : ""}</p>` : ""}
        ${emailButton("Voir le ticket", `${APP_URL}/support`)}
      `;

      const htmlContent = wrapEmailHtml(bodyHtml, signature);

      const result = await sendEmail({
        from: senderFrom,
        to: [adminEmail],
        bcc: bccList,
        subject,
        html: htmlContent,
        _emailType: "support_new_ticket",
      });

      if (!result.success) {
        console.error("sendEmail error:", result.error);
        return new Response(
          JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Confirmation copy to the submitter when a new ticket is created ──
    if (type === "new_ticket_copy") {
      const {
        recipientEmail: copyRecipient,
        ticketNumber: copyNumber,
        ticketTitle: copyTitle,
        ticketType: copyType,
        ticketPriority: copyPrio,
        description: copyDescription,
      } = body;

      if (!copyRecipient || !copyNumber || !copyTitle) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for new_ticket_copy", _version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const copyTypeLabel = copyType === "bug" ? "🐛 Bug" : "💡 Évolution";
      const copyPriorityLabels: Record<string, string> = { critical: "🔴 Critique", high: "🟠 Haute", medium: "🟡 Moyenne", low: "🟢 Basse" };
      const copyPrioLabel = copyPriorityLabels[copyPrio] || copyPrio || "Non définie";

      console.log(`[${VERSION}] new ticket copy to=${copyRecipient} ticket=${copyNumber}`);

      const copySubject = `${copyNumber} — Confirmation de votre signalement « ${copyTitle} »`;
      const copyBodyHtml = `
        <p>Bonjour,</p>
        <p>Nous avons bien reçu votre signalement. Vous trouverez ci-dessous une copie des informations transmises pour votre suivi.</p>
        ${emailInfoBox(`<strong>${copyNumber} — ${copyTitle}</strong>`)}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;color:#666;">Type</td><td style="padding:6px 12px;font-weight:600;">${copyTypeLabel}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;">Priorité</td><td style="padding:6px 12px;font-weight:600;">${copyPrioLabel}</td></tr>
        </table>
        ${copyDescription ? `<p style="background:#f8f9fa;padding:12px;border-radius:8px;color:#333;white-space:pre-wrap;">${copyDescription.slice(0, 2000)}${copyDescription.length > 2000 ? "…" : ""}</p>` : ""}
        <p>Vous pouvez retrouver l'ensemble de vos signalements dans l'onglet « Mes tickets » de l'assistant Supertilt.</p>
        ${emailButton("Voir mes tickets", `${APP_URL}/support`)}
      `;

      const copyHtmlContent = wrapEmailHtml(copyBodyHtml, signature);

      const result = await sendEmail({
        from: senderFrom,
        to: [copyRecipient],
        subject: copySubject,
        html: copyHtmlContent,
        _emailType: "support_new_ticket_copy",
      });

      if (!result.success) {
        console.error("sendEmail error:", result.error);
        return new Response(
          JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Ticket resolved notification (to submitter, legacy) ──
    const { recipientEmail, ticketNumber, ticketTitle, status, resolutionNotes } = body ?? {};

    if (!recipientEmail || !ticketNumber || !ticketTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabel = status === "resolu" ? "Résolu" : "Fermé";

    console.log(
      `[${VERSION}] support notification to=${recipientEmail} ticket=${ticketNumber} status=${status}`
    );

    const subject = `${ticketNumber} — Votre demande "${ticketTitle}" a été traitée`;

    const bodyHtml = `
      <p>Bonjour,</p>
      <p>Votre demande de support a été traitée et son statut est maintenant : <strong>${statusLabel}</strong>.</p>
      ${emailInfoBox(`<strong>${ticketNumber} — ${ticketTitle}</strong>`)}
      ${resolutionNotes ? emailSuccessBox("Notes de résolution :", resolutionNotes) : ""}
      <p>Si vous avez des questions, n'hésitez pas à créer un nouveau ticket de support.</p>
      ${emailButton("Voir mes tickets", `${APP_URL}/support`)}
    `;

    const htmlContent = wrapEmailHtml(bodyHtml, signature);

    const result = await sendEmail({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: htmlContent,
      _emailType: "support_notification",
    });

    if (!result.success) {
      console.error("sendEmail error:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-support-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
