import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom } from "../_shared/email-settings.ts";

/**
 * Consolidated Daily Digest
 *
 * Called daily at 7:00 AM by a cron job.
 * Sends a SINGLE digest email per user with all alerts, in this order:
 *   1. Missions à facturer
 *   2. Devis à faire (colonne contacté)
 *   3. Opportunités à traiter (première colonne)
 *   4. Devis à relancer (devis envoyé)
 *   5. Formations à traiter (conventions manquantes + signature en attente)
 *   6. Articles à relire
 *   7. Événements approchant (< 15 jours)
 *
 * Admins see everything; non-admins see only their assigned trainings.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-logistics-reminders@4.0.0";

// ─── Types ───
interface AlertRecipient {
  userId: string;
  email: string;
  firstName: string;
  isAdmin: boolean;
}

interface TrainingAlert {
  trainingId: string;
  assignedTo: string | null;
  html: string;
}

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

serve(async (req) => {
  console.log(`[${VERSION}] Starting consolidated daily digest...`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date(today);

    // ── Fetch all recipients: admins OR users with formations/crm/missions module access ──
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, is_admin");

    const { data: moduleAccess } = await supabase
      .from("user_module_access")
      .select("user_id, module");

    const moduleUserIds = new Set<string>();
    (moduleAccess || []).forEach((m: any) => {
      if (["formations", "crm", "missions", "contenu", "events"].includes(m.module)) {
        moduleUserIds.add(m.user_id);
      }
    });

    const recipients: AlertRecipient[] = (allProfiles || [])
      .filter((p: any) => p.is_admin || moduleUserIds.has(p.user_id))
      .map((p: any) => ({
        userId: p.user_id,
        email: p.email,
        firstName: p.first_name || p.email.split("@")[0],
        isAdmin: p.is_admin === true,
      }));

    if (recipients.length === 0) {
      console.log(`[${VERSION}] No recipients found`);
      return new Response(
        JSON.stringify({ success: true, message: "No recipients", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Found ${recipients.length} recipient(s)`);

    // ════════════════════════════════════════════
    // 1. MISSIONS À FACTURER
    // ════════════════════════════════════════════
    const { data: missionsToInvoice } = await supabase
      .from("missions")
      .select("id, title, client_name, consumed_amount, billed_amount, emoji")
      .in("status", ["in_progress", "completed"]);

    const missionAlerts: string[] = [];
    if (missionsToInvoice) {
      for (const m of missionsToInvoice) {
        const consumed = Number(m.consumed_amount) || 0;
        const billed = Number(m.billed_amount) || 0;
        if (consumed <= 0 || billed >= consumed) continue;
        const remaining = consumed - billed;
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emojiPrefix = m.emoji ? `${m.emoji} ` : "";
        missionAlerts.push(
          `<li>${emojiPrefix}<a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a> — <strong>${remaining.toLocaleString("fr-FR")} € à facturer</strong> (${billed.toLocaleString("fr-FR")} € facturé / ${consumed.toLocaleString("fr-FR")} € consommé)</li>`
        );
      }
    }
    console.log(`[${VERSION}] Missions à facturer: ${missionAlerts.length}`);

    // ════════════════════════════════════════════
    // 2-4. CRM: Devis à faire, Opportunités, Devis à relancer
    // ════════════════════════════════════════════
    // Fetch CRM columns to find the target columns dynamically
    const { data: crmColumns } = await supabase
      .from("crm_columns")
      .select("id, name, position")
      .eq("is_archived", false)
      .order("position", { ascending: true });

    const columns = crmColumns || [];
    const firstColumn = columns.length > 0 ? columns[0] : null;
    const contacteColumn = columns.find((c: any) => c.name.toLowerCase().includes("contact"));
    const devisEnvoyeColumn = columns.find((c: any) => c.name.toLowerCase().includes("devis envoy"));

    // Collect target column IDs
    const targetColumnIds = new Set<string>();
    if (firstColumn) targetColumnIds.add(firstColumn.id);
    if (contacteColumn) targetColumnIds.add(contacteColumn.id);
    if (devisEnvoyeColumn) targetColumnIds.add(devisEnvoyeColumn.id);

    // Fetch OPEN CRM cards in target columns
    let crmCards: any[] = [];
    if (targetColumnIds.size > 0) {
      const { data: cards } = await supabase
        .from("crm_cards")
        .select("id, title, company, first_name, last_name, email, phone, column_id, estimated_value, emoji, created_at")
        .eq("sales_status", "OPEN")
        .in("column_id", [...targetColumnIds]);
      crmCards = cards || [];
    }

    // Group CRM cards by column
    const cardsByColumn = new Map<string, typeof crmCards>();
    for (const card of crmCards) {
      const list = cardsByColumn.get(card.column_id) || [];
      list.push(card);
      cardsByColumn.set(card.column_id, list);
    }

    // Helper to format a CRM card as HTML list item
    const formatCrmCard = (card: any): string => {
      const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
      const label = card.company ? `${card.company} — ${card.title}` : card.title;
      const emojiPrefix = card.emoji ? `${card.emoji} ` : "";
      const value = card.estimated_value && Number(card.estimated_value) > 0
        ? ` — <strong>${Number(card.estimated_value).toLocaleString("fr-FR")} €</strong>`
        : "";
      const contactParts: string[] = [];
      if (contactName) contactParts.push(`<span style="color: #374151;">${contactName}</span>`);
      if (card.phone) contactParts.push(`<a href="tel:${card.phone.replace(/\s/g, "")}" style="color: #b8960a; text-decoration: none;">📞 ${card.phone}</a>`);
      if (card.email) contactParts.push(`<a href="mailto:${card.email}" style="color: #b8960a; text-decoration: none;">✉️ ${card.email}</a>`);
      const contactHtml = contactParts.length > 0 ? `<br/><span style="font-size: 13px;">${contactParts.join(" · ")}</span>` : "";
      return `<li style="margin-bottom: 6px;">${emojiPrefix}<a href="${appUrl}/crm" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a>${value}${contactHtml}</li>`;
    };

    // 2. Devis à faire (colonne contacté)
    const devisAFaireCards = contacteColumn ? (cardsByColumn.get(contacteColumn.id) || []) : [];
    const devisAFaireAlerts = devisAFaireCards.map(formatCrmCard);
    console.log(`[${VERSION}] Devis à faire (contacté): ${devisAFaireAlerts.length}`);

    // 3. Opportunités à traiter (première colonne)
    // Avoid duplicates if first column = contacté column
    const firstColumnCards = firstColumn && firstColumn.id !== contacteColumn?.id
      ? (cardsByColumn.get(firstColumn.id) || [])
      : firstColumn && firstColumn.id === contacteColumn?.id
        ? [] // already shown in devis à faire
        : [];
    const opportunitesAlerts = firstColumnCards.map(formatCrmCard);
    console.log(`[${VERSION}] Opportunités à traiter: ${opportunitesAlerts.length}`);

    // 4. Devis à relancer (devis envoyé)
    const devisRelanceCards = devisEnvoyeColumn ? (cardsByColumn.get(devisEnvoyeColumn.id) || []) : [];
    const devisRelanceAlerts = devisRelanceCards.map(formatCrmCard);
    console.log(`[${VERSION}] Devis à relancer (envoyé): ${devisRelanceAlerts.length}`);

    // ════════════════════════════════════════════
    // 5. FORMATIONS À TRAITER (conventions)
    // ════════════════════════════════════════════
    const { data: allTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, location, format_formation, convention_file_url, signed_convention_urls, sponsor_email, assigned_to")
      .gt("start_date", today);

    const trainings = allTrainings || [];
    const trainingIds = trainings.map((t) => t.id);

    // Fetch participants and signatures in bulk
    const { data: allParticipants } = trainingIds.length > 0
      ? await supabase
          .from("training_participants")
          .select("id, training_id, first_name, last_name, email, company, convention_file_url, signed_convention_url, sponsor_email, payment_mode")
          .in("training_id", trainingIds)
      : { data: [] };
    const participants = allParticipants || [];

    const { data: allSignatures } = trainingIds.length > 0
      ? await supabase
          .from("convention_signatures")
          .select("training_id, recipient_email, status")
          .in("training_id", trainingIds)
      : { data: [] };
    const signatures = allSignatures || [];

    // Group by training
    const participantsByTraining = new Map<string, typeof participants>();
    for (const p of participants) {
      const list = participantsByTraining.get(p.training_id) || [];
      list.push(p);
      participantsByTraining.set(p.training_id, list);
    }

    const signaturesByKey = new Map<string, string>();
    for (const sig of signatures) {
      signaturesByKey.set(`${sig.training_id}:${sig.recipient_email}`, sig.status);
    }

    const userCanSeeTraining = (recipient: AlertRecipient, assignedTo: string | null): boolean => {
      if (recipient.isAdmin) return true;
      return assignedTo === recipient.userId;
    };

    // 5a. Conventions non générées
    const conventionNotGenAlerts: TrainingAlert[] = [];
    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra && !t.convention_file_url) {
        const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        conventionNotGenAlerts.push({
          trainingId: t.id,
          assignedTo: t.assigned_to,
          html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non générée</li>`,
        });
      } else if (isInterOrElearning) {
        const tParticipants = participantsByTraining.get(t.id) || [];
        const missingParticipants = tParticipants.filter(
          (p) => !p.convention_file_url && p.payment_mode !== "online"
        );
        if (missingParticipants.length > 0) {
          const names = missingParticipants.map(
            (p) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email
          );
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
          conventionNotGenAlerts.push({
            trainingId: t.id,
            assignedTo: t.assigned_to,
            html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non générée pour : ${names.join(", ")}</li>`,
          });
        }
      }
    }

    // 5b. Conventions non signées
    const conventionNotSignedAlerts: TrainingAlert[] = [];
    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra && t.convention_file_url) {
        const signedUrls = t.signed_convention_urls || [];
        if (signedUrls.length === 0) {
          const sigKey = `${t.id}:${t.sponsor_email}`;
          const sigStatus = signaturesByKey.get(sigKey);
          const label = sigStatus === "signed"
            ? null
            : sigStatus === "pending"
              ? "Signature électronique en attente"
              : "Convention non signée";

          if (label) {
            const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
            conventionNotSignedAlerts.push({
              trainingId: t.id,
              assignedTo: t.assigned_to,
              html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — ${label}</li>`,
            });
          }
        }
      } else if (isInterOrElearning) {
        const tParticipants = participantsByTraining.get(t.id) || [];
        const unsignedNames: string[] = [];
        for (const p of tParticipants) {
          if (p.payment_mode === "online") continue;
          if (!p.convention_file_url) continue;
          if (p.signed_convention_url) continue;
          const sigKey = `${t.id}:${p.sponsor_email}`;
          const sigStatus = signaturesByKey.get(sigKey);
          if (sigStatus === "signed") continue;
          unsignedNames.push(`${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email);
        }
        if (unsignedNames.length > 0) {
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
          conventionNotSignedAlerts.push({
            trainingId: t.id,
            assignedTo: t.assigned_to,
            html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non signée pour : ${unsignedNames.join(", ")}</li>`,
          });
        }
      }
    }
    console.log(`[${VERSION}] Conventions non générées: ${conventionNotGenAlerts.length}, non signées: ${conventionNotSignedAlerts.length}`);

    // ════════════════════════════════════════════
    // 6. ARTICLES À RELIRE
    // ════════════════════════════════════════════
    const { data: pendingReviews } = await supabase
      .from("content_reviews")
      .select("id, card_id, reviewer_email, status, created_at, content_cards(title)")
      .in("status", ["pending", "in_review"])
      .order("created_at", { ascending: true });

    const reviewsByReviewerEmail = new Map<string, any[]>();
    if (pendingReviews) {
      for (const review of pendingReviews) {
        const email = review.reviewer_email || "";
        const list = reviewsByReviewerEmail.get(email) || [];
        list.push(review);
        reviewsByReviewerEmail.set(email, list);
      }
    }
    console.log(`[${VERSION}] Articles à relire: ${pendingReviews?.length || 0}`);

    // ════════════════════════════════════════════
    // 7. ÉVÉNEMENTS APPROCHANT (< 15 jours)
    // ════════════════════════════════════════════
    const fifteenDaysFromNow = new Date(todayDate);
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
    const maxEventDate = fifteenDaysFromNow.toISOString().split("T")[0];

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, event_time, location, location_type")
      .gte("event_date", today)
      .lte("event_date", maxEventDate)
      .order("event_date", { ascending: true });

    const eventAlerts: string[] = [];
    if (upcomingEvents) {
      for (const ev of upcomingEvents) {
        const daysUntil = Math.ceil((new Date(ev.event_date).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventDate = new Date(ev.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = ev.event_time ? ` à ${ev.event_time.substring(0, 5)}` : "";
        const locationStr = ev.location ? ` — ${ev.location}` : "";
        const daysLabel = daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `Dans ${daysUntil}j`;
        eventAlerts.push(
          `<li><a href="${appUrl}/evenements" style="color: ${COLORS.primary}; text-decoration: underline;">${ev.title}</a> — ${eventDate}${timeStr}${locationStr} <strong>(${daysLabel})</strong></li>`
        );
      }
    }
    console.log(`[${VERSION}] Événements approchant: ${eventAlerts.length}`);

    // ════════════════════════════════════════════
    // EXTRA: Formations terminées sans facture
    // ════════════════════════════════════════════
    const invoiceAlerts: TrainingAlert[] = [];
    const { data: pastTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, invoice_file_url, assigned_to")
      .lt("start_date", today)
      .is("invoice_file_url", null);

    if (pastTrainings) {
      for (const t of pastTrainings) {
        const endDate = t.end_date || t.start_date;
        if (new Date(endDate) >= new Date(today)) continue;
        const daysAgo = Math.ceil((Date.now() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
        const formattedDate = new Date(endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        invoiceAlerts.push({
          trainingId: t.id,
          assignedTo: t.assigned_to,
          html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${t.training_name}</a> — terminée le ${formattedDate} (il y a ${daysAgo}j)</li>`,
        });
      }
    }

    // ════════════════════════════════════════════
    // SEND PER-USER DIGEST EMAIL
    // ════════════════════════════════════════════
    const senderFrom = await getSenderFrom();
    let emailsSent = 0;
    let totalAlertsSent = 0;

    for (const recipient of recipients) {
      const sections: string[] = [];
      let alertCount = 0;

      // 1. Missions à facturer (visible to all)
      if (missionAlerts.length > 0) {
        sections.push(sectionHtml("💰", "Missions à facturer", COLORS.green, missionAlerts, missionAlerts.length));
        alertCount += missionAlerts.length;
      }

      // 2. Devis à faire (colonne contacté)
      if (devisAFaireAlerts.length > 0) {
        sections.push(sectionHtml("📝", "Devis à faire", COLORS.blue, devisAFaireAlerts, devisAFaireAlerts.length));
        alertCount += devisAFaireAlerts.length;
      }

      // 3. Opportunités à traiter (première colonne)
      if (opportunitesAlerts.length > 0) {
        const colName = firstColumn?.name || "Nouvelles";
        sections.push(sectionHtml("🎯", `Opportunités à traiter (${colName})`, COLORS.amber, opportunitesAlerts, opportunitesAlerts.length));
        alertCount += opportunitesAlerts.length;
      }

      // 4. Devis à relancer (devis envoyé)
      if (devisRelanceAlerts.length > 0) {
        sections.push(sectionHtml("🔄", "Devis à relancer", COLORS.orange, devisRelanceAlerts, devisRelanceAlerts.length));
        alertCount += devisRelanceAlerts.length;
      }

      // 5. Formations à traiter (conventions)
      const userConvNotGen = conventionNotGenAlerts.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      const userConvNotSigned = conventionNotSignedAlerts.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      const formationItems = [
        ...userConvNotGen.map((a) => a.html),
        ...userConvNotSigned.map((a) => a.html),
      ];
      if (formationItems.length > 0) {
        sections.push(sectionHtml("🎓", "Formations à traiter", COLORS.red, formationItems, formationItems.length));
        alertCount += formationItems.length;
      }

      // 6. Articles à relire
      const userReviews = reviewsByReviewerEmail.get(recipient.email);
      if (recipient.isAdmin && pendingReviews && pendingReviews.length > 0) {
        const reviewItems: string[] = [];
        for (const [reviewer, reviews] of reviewsByReviewerEmail) {
          const items = reviews.map((r: any) => {
            const cardTitle = r.content_cards?.title || "Sans titre";
            const daysAgo = Math.ceil((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return `<a href="${appUrl}/contenu?card=${r.card_id}" style="color: ${COLORS.primary}; text-decoration: underline;">${cardTitle}</a> (${daysAgo}j)`;
          });
          reviewItems.push(
            `<li><strong>${reviewer}</strong> : ${items.join(" · ")}</li>`
          );
        }
        sections.push(sectionHtml("📋", "Articles à relire", COLORS.purple, reviewItems, pendingReviews.length));
        alertCount += pendingReviews.length;
      } else if (userReviews && userReviews.length > 0) {
        const items = userReviews.map((r: any) => {
          const cardTitle = r.content_cards?.title || "Sans titre";
          const daysAgo = Math.ceil((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return `<li><a href="${appUrl}/contenu?card=${r.card_id}" style="color: ${COLORS.primary}; text-decoration: underline;">${cardTitle}</a> — En attente depuis ${daysAgo}j</li>`;
        });
        sections.push(sectionHtml("📋", "Articles à relire", COLORS.purple, items, userReviews.length));
        alertCount += userReviews.length;
      }

      // 7. Événements approchant
      if (eventAlerts.length > 0) {
        sections.push(sectionHtml("📅", "Événements approchant", COLORS.teal, eventAlerts, eventAlerts.length));
        alertCount += eventAlerts.length;
      }

      // EXTRA: Formations terminées sans facture
      const userInvoiceAlerts = invoiceAlerts.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      if (userInvoiceAlerts.length > 0) {
        sections.push(sectionHtml("🧾", "Formations terminées sans facture", COLORS.red, userInvoiceAlerts.map((a) => a.html), userInvoiceAlerts.length));
        alertCount += userInvoiceAlerts.length;
      }

      // Skip if no alerts for this user
      if (sections.length === 0) continue;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
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
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: senderFrom,
            to: [recipient.email],
            subject: `🔔 ${alertCount} alerte${alertCount > 1 ? "s" : ""} — Récapitulatif quotidien`,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`[${VERSION}] Email failed for ${recipient.email}:`, errorText);
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
