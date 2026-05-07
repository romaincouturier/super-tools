import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, emailSuccessBox, wrapEmailHtml } from "../_shared/templates.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const VERSION = "send-support-notification@2026-05-07.1";

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

    // ── Discussion request — propose un échange de vive voix ──
    if (type === "discussion_request") {
      const {
        recipientEmail: discRecipient,
        ticketNumber: discNumber,
        ticketTitle: discTitle,
        description: discDescription,
      } = body;

      if (!discRecipient || !discNumber || !discTitle) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for discussion_request", _version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[${VERSION}] discussion request to=${discRecipient} ticket=${discNumber}`);

      const discSubject = `${discNumber} — Échangeons de vive voix sur ta demande « ${discTitle} »`;
      const discBodyHtml = `
        <p>Bonjour,</p>
        <p>Merci pour ta demande de support. Pour bien comprendre ton besoin et te proposer la meilleure solution, j'aimerais qu'on prenne quelques minutes pour en discuter de vive voix.</p>
        ${emailInfoBox(`<strong>${discNumber} — ${discTitle}</strong>`)}
        ${discDescription ? `<p style="background:#f8f9fa;padding:12px;border-radius:8px;color:#333;white-space:pre-wrap;">${discDescription.slice(0, 1500)}${discDescription.length > 1500 ? "…" : ""}</p>` : ""}
        <p>Peux-tu me proposer un créneau qui te convient cette semaine ? Un simple mail en réponse avec 2 ou 3 disponibilités me permettra de bloquer un temps d'échange rapidement.</p>
        <p>À très vite,</p>
        ${emailButton("Voir le ticket", `${APP_URL}/support`)}
      `;

      const discHtmlContent = wrapEmailHtml(discBodyHtml, signature);

      const result = await sendEmail({
        from: senderFrom,
        to: [discRecipient],
        bcc: bccList,
        subject: discSubject,
        html: discHtmlContent,
        _emailType: "support_discussion_request",
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
    const { recipientEmail, ticketNumber, ticketId, ticketTitle, description, status, resolutionNotes } = body ?? {};

    if (!recipientEmail || !ticketNumber || !ticketTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabel = "Résolu";

    console.log(
      `[${VERSION}] support notification to=${recipientEmail} ticket=${ticketNumber} status=${status}`
    );

    // Build 3-line preview of the original description (plain text, no HTML).
    const descriptionPreview = (() => {
      if (!description) return null;
      const plain = String(description)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const lines = plain.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const preview = lines.slice(0, 3).join(" ");
      return preview.length > 300 ? preview.slice(0, 297) + "…" : preview;
    })();

    const ticketUrl = ticketId
      ? `${APP_URL}/support?q=${encodeURIComponent(ticketNumber)}`
      : `${APP_URL}/support`;

    const subject = `${ticketNumber} — Votre demande "${ticketTitle}" a été traitée`;

    const bodyHtml = `
      <p>Bonjour,</p>
      <p>Votre demande de support a été traitée et son statut est maintenant : <strong>${statusLabel}</strong>.</p>
      ${emailInfoBox(`<strong>${ticketNumber} — ${ticketTitle}</strong>${descriptionPreview ? `<br><span style="color:#6b7280;font-size:0.9em">${descriptionPreview}</span>` : ""}`)}
      ${resolutionNotes ? emailSuccessBox("Notes de résolution :", resolutionNotes) : ""}
      <p>Si vous avez des questions, n'hésitez pas à créer un nouveau ticket de support.</p>
      ${emailButton("Voir le ticket", ticketUrl)}
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
