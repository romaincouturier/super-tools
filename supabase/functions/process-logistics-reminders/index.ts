import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { skipIfNonWorkingDay } from "../_shared/working-days.ts";
import { formatDateFr, formatDateWithDayFr } from "../_shared/date-utils.ts";
import {
  fetchAllDailyData,
  userCanSee,
  REVIEW_COLUMN_ASSIGNMENTS,
  type Recipient,
  type DailyData,
  type CrmCardItem,
  type ReservationItem,
  type TrainingConventionItem,
} from "../_shared/daily-data-fetchers.ts";

/**
 * Consolidated Daily Digest
 *
 * Called daily at 7:00 AM by a cron job.
 * Sends a SINGLE digest email per user with all alerts.
 *
 * Data fetching is shared with generate-daily-actions via _shared/daily-data-fetchers.ts.
 */

const VERSION = "process-logistics-reminders@6.0.0";

// ─── Styles ───
const COLORS = {
  primary: "#1a1a2e",
  accent: "#e6bc00",
  green: "#22c55e",
  blue: "#3b82f6",
  orange: "#F97316",
  red: "#EF4444",
  purple: "#8B5CF6",
  teal: "#14b8a6",
  amber: "#F59E0B",
};

function sectionHtml(emoji: string, title: string, color: string, items: string[], count?: number): string {
  const countLabel = count !== undefined ? ` (${count})` : "";
  return `
    <div style="margin-bottom: 28px;">
      <h3 style="color: ${color}; margin: 0 0 10px 0; font-size: 15px; font-weight: 600; border-bottom: 2px solid ${color}; padding-bottom: 6px;">
        ${emoji} ${title}${countLabel}
      </h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">${items.join("")}</ul>
    </div>
  `;
}

// ─── HTML formatters ───

function formatLabel(clientName: string | null, title: string): string {
  return clientName ? `${clientName} — ${title}` : title;
}

function linkHtml(href: string, text: string, bold = false): string {
  const content = bold ? `<strong>${text}</strong>` : text;
  return `<a href="${href}" style="color: ${COLORS.primary}; text-decoration: underline;">${content}</a>`;
}

function formatCrmCardHtml(card: CrmCardItem, appUrl: string): string {
  const label = card.company ? `${card.company} — ${card.title}` : card.title;
  const emojiPrefix = card.emoji ? `${card.emoji} ` : "";
  const value = card.estimatedValue && card.estimatedValue > 0
    ? ` — <strong>${card.estimatedValue.toLocaleString("fr-FR")} €</strong>`
    : "";
  const contactParts: string[] = [];
  const contactName = [card.firstName, card.lastName].filter(Boolean).join(" ");
  if (contactName) contactParts.push(`<span style="color: #374151;">${contactName}</span>`);
  if (card.phone) contactParts.push(`<a href="tel:${card.phone.replace(/\s/g, "")}" style="color: #b8960a; text-decoration: none;">📞 ${card.phone}</a>`);
  if (card.email) contactParts.push(`<a href="mailto:${card.email}" style="color: #b8960a; text-decoration: none;">✉️ ${card.email}</a>`);
  const contactHtml = contactParts.length > 0 ? `<br/><span style="font-size: 13px;">${contactParts.join(" · ")}</span>` : "";
  return `<li style="margin-bottom: 6px;">${emojiPrefix}${linkHtml(`${appUrl}/crm`, label)}${value}${contactHtml}</li>`;
}

function formatReservationItems(r: ReservationItem): string {
  const items: string[] = [];
  if (r.needsTrain) items.push("🚄 Train");
  if (r.needsHotel) items.push("🏨 Hôtel");
  if (r.needsRestaurant) items.push("🍽️ Restaurant");
  if (r.needsRoom) items.push("🚪 Salle");
  if (r.needsEquipment) items.push("📦 Matériel");
  return items.join(" + ");
}


function conventionIssueLabel(issue: TrainingConventionItem["issue"]): string {
  switch (issue) {
    case "not_generated": return "Convention non générée";
    case "not_signed": return "Convention non signée";
    case "pending_signature": return "Signature électronique en attente";
  }
}

serve(async (req) => {
  console.log(`[${VERSION}] Starting consolidated daily digest...`);

  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
    const supabase = getSupabaseClient();

    // Skip on non-working days (weekends by default)
    const skip = await skipIfNonWorkingDay(supabase, VERSION, corsHeaders);
    if (skip) return skip;

    const today = new Date().toISOString().split("T")[0];

    // ── Fetch all data using shared fetchers ──
    const data = await fetchAllDailyData(supabase, today);
    const { recipients } = data;

    if (recipients.length === 0) {
      console.log(`[${VERSION}] No recipients found`);
      return new Response(
        JSON.stringify({ success: true, message: "No recipients", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Found ${recipients.length} recipient(s)`);
    logDataCounts(data);

    // ── Build email-specific lookups ──
    // Review articles by email
    const reviewCardsByEmail = new Map<string, typeof data.reviewArticles>();
    for (const card of data.reviewArticles) {
      const assignment = REVIEW_COLUMN_ASSIGNMENTS[card.columnId];
      if (!assignment) continue;
      const list = reviewCardsByEmail.get(assignment.email) || [];
      list.push(card);
      reviewCardsByEmail.set(assignment.email, list);
    }

    // Unresolved comments by userId
    const commentsByUserId = new Map<string, typeof data.unresolvedComments>();
    for (const comment of data.unresolvedComments) {
      for (const uid of comment.targetUserIds) {
        const list = commentsByUserId.get(uid) || [];
        list.push(comment);
        commentsByUserId.set(uid, list);
      }
    }

    // CRM cards by category
    const crmByCategory = {
      devis_a_faire: data.crmCards.filter(c => c.category === "devis_a_faire"),
      opportunites: data.crmCards.filter(c => c.category === "opportunites"),
      devis_a_relancer: data.crmCards.filter(c => c.category === "devis_a_relancer"),
    };

    // ── Send per-user digest ──
    const [senderFrom, bccList] = await Promise.all([getSenderFrom(), getBccList()]);
    let emailsSent = 0;
    let totalAlertsSent = 0;

    for (const recipient of recipients) {
      const sections: string[] = [];
      let alertCount = 0;

      const add = (emoji: string, title: string, color: string, items: string[]) => {
        if (items.length === 0) return;
        sections.push(sectionHtml(emoji, title, color, items, items.length));
        alertCount += items.length;
      };

      // 0. Missions — Actions à traiter
      add("🎯", "Missions — Actions à traiter", COLORS.primary,
        data.missionActions
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(m => {
            const label = formatLabel(m.clientName, m.title);
            const emojiP = m.emoji ? `${m.emoji} ` : "";
            const overdue = m.isOverdue
              ? ` <span style="color: ${COLORS.red};">⚠️ En retard (${formatDateFr(m.actionDate)})</span>`
              : "";
            return `<li style="margin-bottom: 6px;">${emojiP}${linkHtml(`${appUrl}/missions/${m.id}`, label, true)} — ${m.actionText}${overdue}</li>`;
          })
      );

      // 1. Factures à émettre (formations)
      add("🧾", "Factures à émettre", COLORS.red,
        data.pastTrainingsNoInvoice
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(t => `<li>${linkHtml(`${appUrl}/formations/${t.trainingId}`, t.trainingName)} — terminée le ${formatDateFr(t.endDate)} (il y a ${t.daysAgo}j)</li>`)
      );

      // 2. Missions à facturer
      add("💰", "Factures missions", COLORS.green,
        data.missionsToInvoice
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(m => {
            const label = formatLabel(m.clientName, m.title);
            const emojiP = m.emoji ? `${m.emoji} ` : "";
            return `<li>${emojiP}${linkHtml(`${appUrl}/missions/${m.id}`, label)} — <strong>${m.remaining.toLocaleString("fr-FR")} € à facturer</strong> (${m.billed.toLocaleString("fr-FR")} € facturé / ${m.consumed.toLocaleString("fr-FR")} € consommé)</li>`;
          })
      );

      // 2b. Activités non facturées
      add("📋", "Activités non facturées", COLORS.amber,
        data.unbilledActivities
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(m => {
            const label = formatLabel(m.clientName, m.title);
            const emojiP = m.emoji ? `${m.emoji} ` : "";
            return `<li>${emojiP}${linkHtml(`${appUrl}/missions/${m.missionId}`, label)} — <strong>${m.activityCount} activité(s) non facturée(s)</strong> (${m.totalUnbilled.toLocaleString("fr-FR")} €)</li>`;
          })
      );

      // 3. E-learning groupes privés
      add("💬", "Groupes privés e-learning", COLORS.purple,
        data.elearningGroups
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(t => `<li>💬 <a href="${t.privateGroupUrl}" style="color: ${COLORS.primary}; text-decoration: underline; font-weight: 600;">${t.trainingName}</a> — <strong>Répondre aux messages du groupe privé</strong></li>`)
      );

      // 4. OKR Initiatives
      if (data.okrInitiatives.length > 0) {
        add("🎯", "Initiatives OKR", COLORS.green,
          data.okrInitiatives.map(i =>
            `<li>${linkHtml(`${appUrl}/okr`, i.title)} — ${i.objectiveTitle} → ${i.keyResultTitle} <span style="color: #6b7280;">(${i.progressPercentage}%)</span></li>`
          )
        );
      }

      // 5. Réservations
      add("🚄", "Réservations à faire", COLORS.blue,
        data.reservations
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(r => {
            const pathMap = { mission: "missions", training: "formations", event: "events" };
            const path = pathMap[r.entityType];
            const dateStr = formatDateFr(r.startDate);
            return `<li>${linkHtml(`${appUrl}/${path}/${r.entityId}`, `${r.emoji || "📋"} ${r.title}`)} — ${formatReservationItems(r)} à réserver — ${r.location} (${dateStr})</li>`;
          })
      );

      // 6. Missions sans date
      add("📅", "Missions sans date de début", COLORS.orange,
        data.missionsNoStartDate
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(m => {
            const label = formatLabel(m.clientName, m.title);
            const emojiP = m.emoji ? `${m.emoji} ` : "";
            return `<li>${emojiP}${linkHtml(`${appUrl}/missions/${m.id}`, label)} — <strong>Date de début à définir</strong></li>`;
          })
      );

      // 7. Devis à faire
      add("📝", "Devis à faire", COLORS.blue,
        crmByCategory.devis_a_faire
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(c => formatCrmCardHtml(c, appUrl))
      );

      // 8. Devis à relancer
      add("🔄", "Devis à relancer", COLORS.orange,
        crmByCategory.devis_a_relancer
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(c => formatCrmCardHtml(c, appUrl))
      );

      // 9. Opportunités
      add("🎯", "Opportunités à contacter", COLORS.amber,
        crmByCategory.opportunites
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(c => formatCrmCardHtml(c, appUrl))
      );

      // 10. Articles en relecture
      const userReviewCards = reviewCardsByEmail.get(recipient.email);
      if (userReviewCards && userReviewCards.length > 0) {
        add("📋", "Articles en relecture", COLORS.purple,
          userReviewCards.map(card => {
            const daysAgo = Math.ceil((Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            return `<li>${linkHtml(`${appUrl}/contenu?card=${card.id}`, card.title)} — ${card.columnName} (${daysAgo}j)</li>`;
          })
        );
      }

      // 10b. Articles bloqués
      add("🚫", "Articles bloqués", COLORS.orange,
        data.blockedArticles.map(a =>
          `<li>${linkHtml(`${appUrl}/contenu?card=${a.id}`, a.title)} — ${a.columnName}</li>`
        )
      );

      // 10c. Commentaires non résolus (groupés par article)
      const userComments = commentsByUserId.get(recipient.userId);
      if (userComments && userComments.length > 0) {
        add("💬", "Commentaires non résolus", COLORS.purple,
          userComments.map(c =>
            `<li>${linkHtml(`${appUrl}/contenu?card=${c.cardId}`, c.cardTitle)} — ${c.commentCount} commentaire${c.commentCount > 1 ? "s" : ""} en attente</li>`
          )
        );
      }

      // 11. CFP à soumettre
      add("📨", "CFP à soumettre", COLORS.orange,
        data.cfpAlerts
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(ev => {
            const deadlineDate = formatDateWithDayFr(ev.cfpDeadline);
            const daysLabel = ev.daysUntil === 0 ? "⚠️ Aujourd'hui !" : ev.daysUntil === 1 ? "⚠️ Demain !" : ev.daysUntil <= 7 ? `⚠️ J-${ev.daysUntil}` : `J-${ev.daysUntil}`;
            const cfpLink = ev.cfpUrl
              ? ` — <a href="${ev.cfpUrl}" style="color: ${COLORS.blue}; text-decoration: underline;">Soumettre →</a>`
              : "";
            return `<li>${linkHtml(`${appUrl}/events/${ev.id}`, ev.title)} — deadline ${deadlineDate} <strong>(${daysLabel})</strong>${cfpLink}</li>`;
          })
      );

      // 12. Formations à traiter (conventions)
      const userConventions = data.trainingConventions
        .filter(a => userCanSee(recipient, a.assignedTo))
        .map(t => {
          const dateStr = formatDateFr(t.startDate);
          const label = conventionIssueLabel(t.issue);
          const names = t.participantNames?.length ? ` pour : ${t.participantNames.join(", ")}` : "";
          return `<li>${linkHtml(`${appUrl}/formations/${t.trainingId}`, t.trainingName)} (${dateStr}) — ${label}${names}</li>`;
        });
      add("🎓", "Formations à traiter", COLORS.red, userConventions);

      // 13. Événements approchant
      add("📅", "Événements approchant", COLORS.teal,
        data.upcomingEvents
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(ev => {
            const eventDate = formatDateWithDayFr(ev.eventDate);
            const timeStr = ev.eventTime ? ` à ${ev.eventTime.substring(0, 5)}` : "";
            const locationStr = ev.location ? ` — ${ev.location}` : "";
            const daysLabel = ev.daysUntil === 0 ? "Aujourd'hui" : ev.daysUntil === 1 ? "Demain" : `Dans ${ev.daysUntil}j`;
            return `<li>${linkHtml(`${appUrl}/events/${ev.id}`, ev.title)} — ${eventDate}${timeStr}${locationStr} <strong>(${daysLabel})</strong></li>`;
          })
      );

      // 14. CFP année suivante
      add("🔁", "CFP à surveiller (année suivante)", COLORS.blue,
        data.cfpReminders
          .filter(a => userCanSee(recipient, a.assignedTo))
          .map(ev => {
            const lastCfpDate = new Date(ev.cfpDeadline).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
            const eventLink = ev.eventUrl
              ? ` — <a href="${ev.eventUrl}" style="color: ${COLORS.blue}; text-decoration: underline;">Voir le site →</a>`
              : "";
            return `<li>${linkHtml(`${appUrl}/events/${ev.id}`, ev.title)} — CFP précédent : ${lastCfpDate}. Pensez à vérifier le CFP de cette année !${eventLink}</li>`;
          })
      );

      // Skip if no alerts
      if (sections.length === 0) continue;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 640px; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${COLORS.primary} 0%, #2d2d5e 100%); border-radius: 12px 12px 0 0; padding: 24px 28px;">
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">
        🔔 Récapitulatif quotidien
      </h1>
      <p style="color: #c4c4d4; margin: 6px 0 0 0; font-size: 14px;">
        ${alertCount} alerte${alertCount > 1 ? "s" : ""} pour aujourd'hui
      </p>
    </div>
    <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #374151;">Bonjour ${recipient.firstName},</p>
      ${sections.join("")}
      <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <a href="${appUrl}" style="display: inline-block; background-color: ${COLORS.accent}; color: ${COLORS.primary}; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Ouvrir SuperTools
        </a>
      </div>
    </div>
    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
      SuperTools — Alertes automatiques
    </p>
  </div>
</body>
</html>
      `;

      try {
        const result = await sendEmail({
          from: senderFrom,
          to: [recipient.email],
          bcc: bccList,
          subject: `🔔 ${alertCount} alerte${alertCount > 1 ? "s" : ""} — Récapitulatif quotidien`,
          html: htmlContent,
          _emailType: "logistics_digest",
        });

        if (!result.success) {
          console.error(`[${VERSION}] Email failed for ${recipient.email}:`, result.error);
        } else {
          emailsSent++;
          totalAlertsSent += alertCount;
          console.log(`[${VERSION}] Digest sent to ${recipient.email} with ${alertCount} alerts`);
        }

        // Rate limit: 600ms between sends
        await new Promise((r) => setTimeout(r, 600));
      } catch (error) {
        console.error(`[${VERSION}] Error sending to ${recipient.email}:`, error);
      }
    }

    console.log(`[${VERSION}] Completed: ${emailsSent} email(s) sent, ${totalAlertsSent} total alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        recipientCount: recipients.length,
        emailsSent,
        totalAlerts: totalAlertsSent,
        _version: VERSION,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, _version: VERSION }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function logDataCounts(data: DailyData) {
  console.log(`[${VERSION}] Data: ${data.missionActions.length} mission actions, ${data.elearningGroups.length} e-learning, ${data.missionsToInvoice.length} missions invoice, ${data.unbilledActivities.length} unbilled, ${data.missionsNoStartDate.length} no date, ${data.crmCards.length} CRM, ${data.trainingConventions.length} conventions, ${data.reviewArticles.length} reviews, ${data.blockedArticles.length} blocked, ${data.unresolvedComments.length} comments, ${data.upcomingEvents.length} events, ${data.cfpAlerts.length} CFP, ${data.cfpReminders.length} CFP reminders, ${data.pastTrainingsNoInvoice.length} past trainings, ${data.reservations.length} reservations, ${data.okrInitiatives.length} OKR`);
}
