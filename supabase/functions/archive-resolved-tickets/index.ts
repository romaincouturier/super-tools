import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, wrapEmailHtml } from "../_shared/templates.ts";

const VERSION = "archive-resolved-tickets@2026-05-07.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find resolved, not yet archived
    const { data: tickets, error: fetchErr } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, title, type, priority, resolved_at, submitted_by_email, resolution_notes")
      .eq("status", "resolu")
      .is("archived_at", null);

    if (fetchErr) throw fetchErr;

    const archivedCount = tickets?.length || 0;
    let updated = 0;

    if (archivedCount > 0) {
      const ids = tickets!.map((t) => t.id);
      const { error: updErr } = await supabase
        .from("support_tickets")
        .update({ archived_at: new Date().toISOString() })
        .in("id", ids);
      if (updErr) throw updErr;
      updated = ids.length;
    }

    // Send synthesis email to admin
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();
    const adminEmail = await getSenderEmail();
    const bccList = await getBccList();

    const dateStr = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "long", year: "numeric" });

    // ── User-friendly summary (AI-generated, forwardable) ─────────────
    let userSummaryHtml = "";
    if (archivedCount > 0) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const ticketsList = (tickets || [])
            .map((t) => `- [${t.type === "bug" ? "Bug" : "Évolution"}] ${t.title}${t.resolution_notes ? ` — Résolution : ${t.resolution_notes}` : ""}`)
            .join("\n");
          const prompt = `Tu rédiges une note hebdomadaire à destination des utilisateurs finaux d'une application interne. Résume de manière claire, bienveillante et non technique les améliorations et corrections livrées cette semaine, à partir de la liste de tickets résolus ci-dessous. Ne mentionne pas de numéros de tickets ni de jargon technique. Structure ta réponse en HTML simple : un court paragraphe d'introduction, puis deux sections optionnelles "🐛 Corrections" et "✨ Améliorations" sous forme de listes à puces (1 phrase claire par item). Si une catégorie est vide, ne l'affiche pas. Termine par une phrase de remerciement.\n\nTickets résolus :\n${ticketsList}`;
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const summary = aiData?.choices?.[0]?.message?.content?.trim() || "";
            if (summary) {
              userSummaryHtml = `
                <div style="margin:24px 0;padding:20px;background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:6px;">
                  <h3 style="margin:0 0 12px 0;font-size:15px;color:#0c4a6e;">📣 Note hebdomadaire — à transférer aux utilisateurs</h3>
                  <div style="font-size:14px;color:#0f172a;line-height:1.5;">${summary}</div>
                </div>
              `;
            }
          } else {
            console.warn("[archive-resolved-tickets] AI summary failed:", aiResp.status);
          }
        }
      } catch (err) {
        console.warn("[archive-resolved-tickets] AI summary error:", err);
      }
    }

    const rowsHtml = (tickets || [])
      .map((t) => {
        const typeLabel = t.type === "bug" ? "🐛 Bug" : "💡 Évolution";
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">${t.ticket_number}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${typeLabel}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${t.submitted_by_email || "—"}</td>
        </tr>`;
      })
      .join("");

    const bodyHtml = `
      <p>Synthèse hebdomadaire de la purge des tickets support — ${dateStr}.</p>
      ${emailInfoBox(`<strong>${archivedCount}</strong> ticket${archivedCount > 1 ? "s" : ""} résolu${archivedCount > 1 ? "s" : ""} archivé${archivedCount > 1 ? "s" : ""} et retiré${archivedCount > 1 ? "s" : ""} du Kanban.`)}
      ${
        archivedCount > 0
          ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
              <thead>
                <tr style="background:#f8f9fa;">
                  <th style="padding:8px 12px;text-align:left;">N°</th>
                  <th style="padding:8px 12px;text-align:left;">Type</th>
                  <th style="padding:8px 12px;text-align:left;">Titre</th>
                  <th style="padding:8px 12px;text-align:left;">Soumis par</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>`
          : `<p style="color:#666;">Aucun ticket résolu à archiver cette semaine.</p>`
      }
      ${userSummaryHtml}
      ${emailButton("Ouvrir le support", `${APP_URL}/support`)}
    `;

    const result = await sendEmail({
      from: senderFrom,
      to: [adminEmail],
      bcc: bccList,
      subject: `🧹 Purge support — ${archivedCount} ticket${archivedCount > 1 ? "s" : ""} archivé${archivedCount > 1 ? "s" : ""}`,
      html: wrapEmailHtml(bodyHtml, signature),
      _emailType: "support_weekly_archive",
    });

    if (!result.success) {
      console.error("[archive-resolved-tickets] sendEmail error:", result.error);
    }

    console.log(`[${VERSION}] archived=${updated}`);

    return new Response(
      JSON.stringify({ success: true, archived: updated, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[archive-resolved-tickets] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
