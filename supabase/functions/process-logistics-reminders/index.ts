import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { sendEmail } from "../_shared/resend.ts";

/**
 * Consolidated Daily Digest
 *
 * Called daily at 7:00 AM by a cron job.
 * Sends a SINGLE digest email per user with all alerts, in this order:
 *   1. Factures à émettre (formations terminées sans facture)
 *   2. Factures missions (missions à facturer)
 *   3. Activités non facturées
 *   4. Groupes privés e-learning
 *   5. Initiatives OKR
 *   6. Réservations à faire
 *   7. Missions sans date de début
 *   8. Devis à faire (colonne contacté)
 *   9. Devis à relancer (devis envoyé)
 *  10. Opportunités à contacter (première colonne)
 *  11. Articles à relire
 *  12. CFP à soumettre (< 30 jours)
 *  13. Formations à traiter (conventions manquantes + signature en attente)
 *  14. Événements approchant (< 15 jours)
 *  15. Rappels CFP année suivante (10 mois après deadline)
 *
 * Admins see everything; non-admins see only their assigned trainings.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-logistics-reminders@5.0.0";

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
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
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

    interface GenericAlert {
      assignedTo: string | null;
      html: string;
    }

    // ════════════════════════════════════════════
    // 0. MISSIONS — ACTIONS À TRAITER
    // ════════════════════════════════════════════
    const { data: missionsWithActions } = await supabase
      .from("missions")
      .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date, waiting_next_action_text")
      .not("waiting_next_action_text", "is", null)
      .lte("waiting_next_action_date", today)
      .in("status", ["not_started", "in_progress", "pending"]);

    const missionActionAlerts: GenericAlert[] = [];
    if (missionsWithActions) {
      for (const m of missionsWithActions) {
        if (!m.waiting_next_action_text?.trim()) continue;
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emojiPrefix = m.emoji ? `${m.emoji} ` : "";
        const isOverdue = m.waiting_next_action_date < today;
        const overdueLabel = isOverdue
          ? ` <span style="color: ${COLORS.red};">⚠️ En retard (${new Date(m.waiting_next_action_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})</span>`
          : "";
        missionActionAlerts.push({
          assignedTo: m.assigned_to,
          html: `<li style="margin-bottom: 6px;">${emojiPrefix}<a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline; font-weight: 600;">${label}</a> — ${m.waiting_next_action_text}${overdueLabel}</li>`,
        });
      }
    }
    console.log(`[${VERSION}] Missions actions à traiter: ${missionActionAlerts.length}`);

    // ════════════════════════════════════════════
    // 0a. E-LEARNING EN COURS AVEC GROUPE PRIVÉ
    // ════════════════════════════════════════════
    const { data: activeElearnings } = await supabase
      .from("trainings")
      .select("id, training_name, private_group_url, assigned_to, start_date, end_date")
      .in("format_formation", ["e_learning"])
      .not("private_group_url", "is", null)
      .lte("start_date", today);

    const elearningGroupAlerts: GenericAlert[] = [];
    if (activeElearnings) {
      for (const t of activeElearnings) {
        if (t.end_date && t.end_date < today) continue;
        if (!t.private_group_url?.trim()) continue;
        elearningGroupAlerts.push({
          assignedTo: t.assigned_to,
          html: `<li>💬 <a href="${t.private_group_url.trim()}" style="color: ${COLORS.primary}; text-decoration: underline; font-weight: 600;">${t.training_name}</a> — <strong>Répondre aux messages du groupe privé</strong></li>`,
        });
      }
    }
    console.log(`[${VERSION}] E-learning groupes privés actifs: ${elearningGroupAlerts.length}`);

    // ════════════════════════════════════════════
    // 0b. OKR INITIATIVES ACTIVES
    // ════════════════════════════════════════════
    const okrInitiativeAlerts: GenericAlert[] = [];
    const { data: activeInitiatives } = await supabase
      .from("okr_initiatives")
      .select("id, title, progress_percentage, key_result_id, status")
      .in("status", ["active", "draft"]);

    if (activeInitiatives && activeInitiatives.length > 0) {
      const krIds = [...new Set(activeInitiatives.map((i: any) => i.key_result_id))];
      const { data: keyResults } = await supabase
        .from("okr_key_results")
        .select("id, title, objective_id")
        .in("id", krIds);

      let objectiveMap: Record<string, any> = {};
      if (keyResults && keyResults.length > 0) {
        const objIds = [...new Set(keyResults.map((kr: any) => kr.objective_id))];
        const { data: objectives } = await supabase
          .from("okr_objectives")
          .select("id, title, status, owner_email")
          .in("id", objIds)
          .in("status", ["active"]);
        if (objectives) {
          for (const o of objectives) objectiveMap[o.id] = o;
        }
      }

      const krMap: Record<string, any> = {};
      if (keyResults) {
        for (const kr of keyResults) krMap[kr.id] = kr;
      }

      for (const init of activeInitiatives) {
        const kr = krMap[init.key_result_id];
        if (!kr) continue;
        const obj = objectiveMap[kr.objective_id];
        if (!obj) continue;

        okrInitiativeAlerts.push({
          assignedTo: null,
          html: `<li><a href="${appUrl}/okr" style="color: ${COLORS.primary}; text-decoration: underline; font-weight: 600;">${init.title}</a> — ${obj.title} → ${kr.title} <span style="color: #6b7280;">(${init.progress_percentage}%)</span></li>`,
        });
      }
    }
    console.log(`[${VERSION}] OKR initiatives actives: ${okrInitiativeAlerts.length}`);

    // ════════════════════════════════════════════
    // 0c. RÉSERVATIONS (J-60, rappel quotidien)
    // ════════════════════════════════════════════
    const sixtyDaysLater = new Date(todayDate);
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
    const sixtyDaysStr = sixtyDaysLater.toISOString().split("T")[0];

    const reservationAlerts: GenericAlert[] = [];

    // Missions
    const { data: missionsNeedingBooking } = await supabase
      .from("missions")
      .select("id, title, client_name, location, start_date, train_booked, hotel_booked, assigned_to, emoji")
      .not("location", "is", null)
      .not("start_date", "is", null)
      .gte("start_date", today)
      .lte("start_date", sixtyDaysStr)
      .in("status", ["pending", "in_progress", "not_started"]);

    if (missionsNeedingBooking) {
      for (const m of missionsNeedingBooking) {
        if (!m.location?.trim()) continue;
        const needsTrain = !m.train_booked;
        const needsHotel = !m.hotel_booked;
        if (!needsTrain && !needsHotel) continue;

        const items: string[] = [];
        if (needsTrain) items.push("🚄 Train");
        if (needsHotel) items.push("🏨 Hôtel");
        const startFormatted = new Date(m.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        reservationAlerts.push({
          assignedTo: m.assigned_to,
          html: `<li><a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${m.emoji || "📋"} ${m.title}</a> — ${items.join(" + ")} à réserver — ${m.location} (${startFormatted})</li>`,
        });
      }
    }
    console.log(`[${VERSION}] Réservations missions: ${reservationAlerts.length}`);

    // Formations
    const { data: trainingsNeedingBooking } = await supabase
      .from("trainings")
      .select("id, training_name, location, start_date, train_booked, hotel_booked, restaurant_booked, room_rental_booked, equipment_ready, format_formation, session_type, assigned_to, is_cancelled")
      .not("start_date", "is", null)
      .gte("start_date", today)
      .lte("start_date", sixtyDaysStr)
      .or("is_cancelled.is.null,is_cancelled.eq.false");

    if (trainingsNeedingBooking) {
      for (const t of trainingsNeedingBooking) {
        const hasLocation = t.location?.trim();
        const isPresentiel = t.format_formation !== "e_learning" && t.format_formation !== "classe_virtuelle";
        const isInter = t.format_formation === "inter-entreprises" || t.session_type === "inter";

        const items: string[] = [];
        if (isPresentiel && hasLocation) {
          if (!t.train_booked) items.push("🚄 Train");
          if (!t.hotel_booked) items.push("🏨 Hôtel");
          if (isInter && !t.restaurant_booked) items.push("🍽️ Restaurant");
          if (!t.room_rental_booked) items.push("🚪 Salle");
        }
        if (isPresentiel && !t.equipment_ready) items.push("📦 Matériel");

        if (items.length === 0) continue;

        const startFormatted = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        reservationAlerts.push({
          assignedTo: t.assigned_to,
          html: `<li><a href="${appUrl}/formations/${t.id}" style="color: ${COLORS.primary}; text-decoration: underline;">🎓 ${t.training_name}</a> — ${items.join(" + ")} à réserver — ${hasLocation ? t.location + " " : ""}(${startFormatted})</li>`,
        });
      }
    }
    console.log(`[${VERSION}] Réservations formations: ${trainingsNeedingBooking?.length || 0}`);

    // Événements internes en physique
    const { data: eventsNeedingBooking } = await supabase
      .from("events")
      .select("id, title, event_date, location, location_type, event_type, train_booked, hotel_booked, room_rental_booked, restaurant_booked, assigned_to")
      .eq("event_type", "internal")
      .eq("location_type", "physical")
      .eq("status", "active")
      .not("location", "is", null)
      .gte("event_date", today)
      .lte("event_date", sixtyDaysStr);

    if (eventsNeedingBooking) {
      for (const ev of eventsNeedingBooking) {
        if (!ev.location?.trim()) continue;
        const items: string[] = [];
        if (!ev.train_booked) items.push("🚄 Train");
        if (!ev.hotel_booked) items.push("🏨 Hôtel");
        if (!ev.room_rental_booked) items.push("🚪 Salle");
        if (!ev.restaurant_booked) items.push("🍽️ Restaurant");
        if (items.length === 0) continue;

        const eventDateFormatted = new Date(ev.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        reservationAlerts.push({
          assignedTo: ev.assigned_to,
          html: `<li><a href="${appUrl}/events/${ev.id}" style="color: ${COLORS.primary}; text-decoration: underline;">📅 ${ev.title}</a> — ${items.join(" + ")} à réserver — ${ev.location} (${eventDateFormatted})</li>`,
        });
      }
    }
    console.log(`[${VERSION}] Réservations événements: ${eventsNeedingBooking?.length || 0}`);

    // ════════════════════════════════════════════
    // 1. MISSIONS À FACTURER
    // ════════════════════════════════════════════
    const { data: missionsToInvoice } = await supabase
      .from("missions")
      .select("id, title, client_name, consumed_amount, billed_amount, emoji, assigned_to")
      .in("status", ["in_progress", "completed"]);

    interface MissionAlert {
      assignedTo: string | null;
      html: string;
    }

    const missionAlerts: MissionAlert[] = [];
    if (missionsToInvoice) {
      for (const m of missionsToInvoice) {
        const consumed = Number(m.consumed_amount) || 0;
        const billed = Number(m.billed_amount) || 0;
        if (consumed <= 0 || billed >= consumed) continue;
        const remaining = consumed - billed;
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emojiPrefix = m.emoji ? `${m.emoji} ` : "";
        missionAlerts.push({
          assignedTo: m.assigned_to,
          html: `<li>${emojiPrefix}<a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a> — <strong>${remaining.toLocaleString("fr-FR")} € à facturer</strong> (${billed.toLocaleString("fr-FR")} € facturé / ${consumed.toLocaleString("fr-FR")} € consommé)</li>`,
        });
      }
    }
    console.log(`[${VERSION}] Missions à facturer: ${missionAlerts.length}`);

    // ════════════════════════════════════════════
    // 1c. ACTIVITÉS MISSION NON FACTURÉES
    // ════════════════════════════════════════════
    const { data: unbilledActivities } = await supabase
      .from("mission_activities")
      .select("id, mission_id, billable_amount")
      .eq("is_billed", false)
      .gt("billable_amount", 0);

    interface UnbilledAlert {
      assignedTo: string | null;
      html: string;
    }
    const unbilledAlerts: UnbilledAlert[] = [];

    if (unbilledActivities && unbilledActivities.length > 0) {
      const byMission = new Map<string, any[]>();
      for (const a of unbilledActivities) {
        const list = byMission.get(a.mission_id) || [];
        list.push(a);
        byMission.set(a.mission_id, list);
      }

      const missionIds = [...byMission.keys()];
      const { data: activityMissions } = await supabase
        .from("missions")
        .select("id, title, client_name, emoji, assigned_to")
        .in("id", missionIds);

      if (activityMissions) {
        for (const m of activityMissions) {
          const activities = byMission.get(m.id) || [];
          const totalUnbilled = activities.reduce((sum: number, a: any) => sum + (Number(a.billable_amount) || 0), 0);
          const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
          const emojiPrefix = m.emoji ? `${m.emoji} ` : "";
          unbilledAlerts.push({
            assignedTo: m.assigned_to,
            html: `<li>${emojiPrefix}<a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a> — <strong>${activities.length} activité(s) non facturée(s)</strong> (${totalUnbilled.toLocaleString("fr-FR")} €)</li>`,
          });
        }
      }
    }
    console.log(`[${VERSION}] Activités non facturées: ${unbilledAlerts.length}`);

    // ════════════════════════════════════════════
    // 1b. MISSIONS SANS DATE DE DÉBUT
    // ════════════════════════════════════════════
    const { data: missionsNoStartDate } = await supabase
      .from("missions")
      .select("id, title, client_name, emoji, assigned_to")
      .in("status", ["not_started", "in_progress"])
      .is("start_date", null);

    const missionNoDateAlerts: MissionAlert[] = [];
    if (missionsNoStartDate) {
      for (const m of missionsNoStartDate) {
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emojiPrefix = m.emoji ? `${m.emoji} ` : "";
        missionNoDateAlerts.push({
          assignedTo: m.assigned_to,
          html: `<li>${emojiPrefix}<a href="${appUrl}/missions/${m.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a> — <strong>Date de début à définir</strong></li>`,
        });
      }
    }
    console.log(`[${VERSION}] Missions sans date de début: ${missionNoDateAlerts.length}`);

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
        .select("id, title, company, first_name, last_name, email, phone, column_id, estimated_value, emoji, created_at, assigned_to, waiting_next_action_date, next_action_done")
        .eq("sales_status", "OPEN")
        .in("column_id", [...targetColumnIds]);
      // Filter: only cards with action due today or overdue (or no date = act now)
      crmCards = (cards || []).filter((c: any) => {
        if (c.next_action_done === true) return false;
        if (!c.waiting_next_action_date) return true; // no date = needs action now
        return c.waiting_next_action_date <= today; // due today or overdue
      });
    }

    // Group CRM cards by column
    const cardsByColumn = new Map<string, typeof crmCards>();
    for (const card of crmCards) {
      const list = cardsByColumn.get(card.column_id) || [];
      list.push(card);
      cardsByColumn.set(card.column_id, list);
    }

    // Helper to format a CRM card as typed alert
    interface CrmAlert {
      assignedTo: string | null;
      html: string;
    }

    const formatCrmCard = (card: any): CrmAlert => {
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
      return {
        assignedTo: card.assigned_to,
        html: `<li style="margin-bottom: 6px;">${emojiPrefix}<a href="${appUrl}/crm" style="color: ${COLORS.primary}; text-decoration: underline;">${label}</a>${value}${contactHtml}</li>`,
      };
    };

    // 2. Devis à faire (colonne contacté)
    const devisAFaireCards = contacteColumn ? (cardsByColumn.get(contacteColumn.id) || []) : [];
    const devisAFaireAlerts: CrmAlert[] = devisAFaireCards.map(formatCrmCard);
    console.log(`[${VERSION}] Devis à faire (contacté): ${devisAFaireAlerts.length}`);

    // 3. Opportunités à traiter (première colonne)
    // Avoid duplicates if first column = contacté column
    const firstColumnCards = firstColumn && firstColumn.id !== contacteColumn?.id
      ? (cardsByColumn.get(firstColumn.id) || [])
      : firstColumn && firstColumn.id === contacteColumn?.id
        ? [] // already shown in devis à faire
        : [];
    const opportunitesAlerts: CrmAlert[] = firstColumnCards.map(formatCrmCard);
    console.log(`[${VERSION}] Opportunités à traiter: ${opportunitesAlerts.length}`);

    // 4. Devis à relancer (devis envoyé)
    const devisRelanceCards = devisEnvoyeColumn ? (cardsByColumn.get(devisEnvoyeColumn.id) || []) : [];
    const devisRelanceAlerts: CrmAlert[] = devisRelanceCards.map(formatCrmCard);
    console.log(`[${VERSION}] Devis à relancer (envoyé): ${devisRelanceAlerts.length}`);

    // ════════════════════════════════════════════
    // 5. FORMATIONS À TRAITER (conventions)
    // ════════════════════════════════════════════
    const { data: allTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, location, format_formation, convention_file_url, signed_convention_urls, sponsor_email, assigned_to, is_cancelled")
      .gt("start_date", today)
      .or("is_cancelled.is.null,is_cancelled.eq.false");

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

    const userCanSee = (recipient: AlertRecipient, assignedTo: string | null): boolean => {
      if (recipient.isAdmin) return true;
      if (!assignedTo) return false;
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
    // 6. ARTICLES EN RELECTURE (column-based assignment)
    // ════════════════════════════════════════════
    const REVIEW_COLUMN_ASSIGNMENTS: Record<string, string> = {
      "290ab277-6f1a-48b4-8641-d8b033d667de": "romain@supertilt.fr",    // Relecture en cours Romain
      "2ea6b47e-9d87-41d7-9eaa-95f57ba379da": "emmanuelle@supertilt.fr", // Relecture en cours Manue
    };
    const REVIEW_COLUMN_IDS = Object.keys(REVIEW_COLUMN_ASSIGNMENTS);

    const { data: cardsInReviewColumns } = await supabase
      .from("content_cards")
      .select("id, title, column_id, created_at, content_columns:column_id(name)")
      .in("column_id", REVIEW_COLUMN_IDS);

    // Group cards by assigned email
    const reviewCardsByEmail = new Map<string, any[]>();
    if (cardsInReviewColumns) {
      for (const card of cardsInReviewColumns) {
        const email = REVIEW_COLUMN_ASSIGNMENTS[card.column_id];
        if (!email) continue;
        const list = reviewCardsByEmail.get(email) || [];
        list.push(card);
        reviewCardsByEmail.set(email, list);
      }
    }
    console.log(`[${VERSION}] Articles en relecture: ${cardsInReviewColumns?.length || 0}`);

    // ════════════════════════════════════════════
    // 7. ÉVÉNEMENTS APPROCHANT (< 15 jours)
    // ════════════════════════════════════════════
    const fifteenDaysFromNow = new Date(todayDate);
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
    const maxEventDate = fifteenDaysFromNow.toISOString().split("T")[0];

    interface EventAlert {
      assignedTo: string | null;
      html: string;
    }

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, event_time, location, location_type, event_type, cfp_deadline, cfp_url, assigned_to")
      .gte("event_date", today)
      .lte("event_date", maxEventDate)
      .eq("status", "active")
      .order("event_date", { ascending: true });

    const eventAlerts: EventAlert[] = [];
    if (upcomingEvents) {
      for (const ev of upcomingEvents) {
        const daysUntil = Math.ceil((new Date(ev.event_date).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventDate = new Date(ev.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = ev.event_time ? ` à ${ev.event_time.substring(0, 5)}` : "";
        const locationStr = ev.location ? ` — ${ev.location}` : "";
        const daysLabel = daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `Dans ${daysUntil}j`;
        eventAlerts.push({
          assignedTo: ev.assigned_to,
          html: `<li><a href="${appUrl}/events/${ev.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${ev.title}</a> — ${eventDate}${timeStr}${locationStr} <strong>(${daysLabel})</strong></li>`,
        });
      }
    }
    console.log(`[${VERSION}] Événements approchant: ${eventAlerts.length}`);

    // ════════════════════════════════════════════
    // 8. CFP À SOUMETTRE (dates limites approchant)
    // ════════════════════════════════════════════
    const thirtyDaysFromNow = new Date(todayDate);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const maxCfpDate = thirtyDaysFromNow.toISOString().split("T")[0];

    const { data: cfpEvents } = await supabase
      .from("events")
      .select("id, title, event_date, cfp_deadline, cfp_url, assigned_to")
      .eq("event_type", "external")
      .eq("status", "active")
      .not("cfp_deadline", "is", null)
      .gte("cfp_deadline", today)
      .lte("cfp_deadline", maxCfpDate)
      .order("cfp_deadline", { ascending: true });

    const cfpAlerts: EventAlert[] = [];
    if (cfpEvents) {
      for (const ev of cfpEvents) {
        const daysUntil = Math.ceil((new Date(ev.cfp_deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        const deadlineDate = new Date(ev.cfp_deadline).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const daysLabel = daysUntil === 0 ? "⚠️ Aujourd'hui !" : daysUntil === 1 ? "⚠️ Demain !" : daysUntil <= 7 ? `⚠️ J-${daysUntil}` : `J-${daysUntil}`;
        const cfpLink = ev.cfp_url
          ? ` — <a href="${ev.cfp_url}" style="color: ${COLORS.blue}; text-decoration: underline;">Soumettre →</a>`
          : "";
        cfpAlerts.push({
          assignedTo: ev.assigned_to,
          html: `<li><a href="${appUrl}/events/${ev.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${ev.title}</a> — deadline ${deadlineDate} <strong>(${daysLabel})</strong>${cfpLink}</li>`,
        });
      }
    }
    console.log(`[${VERSION}] CFP à soumettre: ${cfpAlerts.length}`);

    // ════════════════════════════════════════════
    // 9. RAPPELS CFP ANNÉE SUIVANTE (10 mois après le dernier CFP)
    // ════════════════════════════════════════════
    // Pour les événements externes dont la date limite CFP est passée depuis ~10 mois,
    // rappeler de soumettre pour l'édition suivante
    const tenMonthsAgo = new Date(todayDate);
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
    const tenMonthsAgoStr = tenMonthsAgo.toISOString().split("T")[0];
    // Check within a 7-day window around the 10-month mark
    const tenMonthsAgoMinus7 = new Date(tenMonthsAgo);
    tenMonthsAgoMinus7.setDate(tenMonthsAgoMinus7.getDate() - 7);
    const tenMonthsAgoMinus7Str = tenMonthsAgoMinus7.toISOString().split("T")[0];

    const { data: cfpReminderEvents } = await supabase
      .from("events")
      .select("id, title, event_date, cfp_deadline, cfp_url, event_url, assigned_to")
      .eq("event_type", "external")
      .not("cfp_deadline", "is", null)
      .gte("cfp_deadline", tenMonthsAgoMinus7Str)
      .lte("cfp_deadline", tenMonthsAgoStr)
      .order("cfp_deadline", { ascending: true });

    const cfpReminderAlerts: EventAlert[] = [];
    if (cfpReminderEvents) {
      for (const ev of cfpReminderEvents) {
        const lastCfpDate = new Date(ev.cfp_deadline).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        const eventLink = ev.event_url
          ? ` — <a href="${ev.event_url}" style="color: ${COLORS.blue}; text-decoration: underline;">Voir le site →</a>`
          : "";
        cfpReminderAlerts.push({
          assignedTo: ev.assigned_to,
          html: `<li><a href="${appUrl}/events/${ev.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${ev.title}</a> — CFP précédent : ${lastCfpDate}. Pensez à vérifier le CFP de cette année !${eventLink}</li>`,
        });
      }
    }
    console.log(`[${VERSION}] CFP reminders (next year): ${cfpReminderAlerts.length}`);

    // ════════════════════════════════════════════
    // EXTRA: Formations terminées sans facture
    // ════════════════════════════════════════════
    const invoiceAlerts: TrainingAlert[] = [];
    const { data: pastTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, invoice_file_url, assigned_to, format_formation, is_cancelled")
      .lt("start_date", today)
      .is("invoice_file_url", null)
      .or("is_cancelled.is.null,is_cancelled.eq.false");

    if (pastTrainings) {
      // Fetch participants for these trainings to check payment modes
      const pastTrainingIds = pastTrainings
        .filter((t: any) => {
          const endDate = t.end_date || t.start_date;
          return new Date(endDate) < new Date(today);
        })
        .map((t: any) => t.id);

      const participantsByTrainingInvoice = new Map<string, any[]>();
      if (pastTrainingIds.length > 0) {
        const { data: pts } = await supabase
          .from("training_participants")
          .select("training_id, payment_mode, invoice_file_url")
          .in("training_id", pastTrainingIds);
        if (pts) {
          for (const p of pts) {
            const list = participantsByTrainingInvoice.get(p.training_id) || [];
            list.push(p);
            participantsByTrainingInvoice.set(p.training_id, list);
          }
        }
      }

      for (const t of pastTrainings) {
        const endDate = t.end_date || t.start_date;
        if (new Date(endDate) >= new Date(today)) continue;

        // Skip if all participants paid online — no invoice needed
        const participants = participantsByTrainingInvoice.get(t.id) || [];
        if (participants.length > 0) {
          const allPaidOnline = participants.every((p: any) => p.payment_mode === "online");
          if (allPaidOnline) continue;

          // For inter/e-learning: skip if all invoice-mode participants already have their invoice
          const isInterOrElearning = ["inter-entreprises", "e_learning"].includes(t.format_formation);
          if (isInterOrElearning) {
            const invoiceParticipants = participants.filter((p: any) => p.payment_mode !== "online");
            const allInvoiced = invoiceParticipants.length > 0 && invoiceParticipants.every((p: any) => p.invoice_file_url);
            if (allInvoiced) continue;
          }
        }

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
    const [senderFrom, bccList] = await Promise.all([getSenderFrom(), getBccList()]);
    let emailsSent = 0;
    let totalAlertsSent = 0;

    for (const recipient of recipients) {
      const sections: string[] = [];
      let alertCount = 0;

      // 0. Missions — Actions à traiter (EN TÊTE, priorité maximale)
      const userMissionActions = missionActionAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userMissionActions.length > 0) {
        sections.push(sectionHtml("🎯", "Missions — Actions à traiter", COLORS.primary, userMissionActions.map((a) => a.html), userMissionActions.length));
        alertCount += userMissionActions.length;
      }

      // 1. Factures à émettre (formations terminées sans facture)
      const userInvoiceAlerts = invoiceAlerts.filter(
        (a) => userCanSee(recipient, a.assignedTo)
      );
      if (userInvoiceAlerts.length > 0) {
        sections.push(sectionHtml("🧾", "Factures à émettre", COLORS.red, userInvoiceAlerts.map((a) => a.html), userInvoiceAlerts.length));
        alertCount += userInvoiceAlerts.length;
      }

      // 2. Missions à facturer (filtered by assigned_to)
      const userMissionAlerts = missionAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userMissionAlerts.length > 0) {
        sections.push(sectionHtml("💰", "Factures missions", COLORS.green, userMissionAlerts.map((a) => a.html), userMissionAlerts.length));
        alertCount += userMissionAlerts.length;
      }

      // 2b. Activités mission non facturées (filtered by assigned_to)
      const userUnbilledAlerts = unbilledAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userUnbilledAlerts.length > 0) {
        sections.push(sectionHtml("📋", "Activités non facturées", COLORS.amber, userUnbilledAlerts.map((a) => a.html), userUnbilledAlerts.length));
        alertCount += userUnbilledAlerts.length;
      }

      // 3. E-learning groupes privés
      const userElearningAlerts = elearningGroupAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userElearningAlerts.length > 0) {
        sections.push(sectionHtml("💬", "Groupes privés e-learning", COLORS.purple, userElearningAlerts.map((a) => a.html), userElearningAlerts.length));
        alertCount += userElearningAlerts.length;
      }

      // 4. OKR Initiatives actives
      if (okrInitiativeAlerts.length > 0) {
        sections.push(sectionHtml("🎯", "Initiatives OKR", COLORS.green, okrInitiativeAlerts.map((a) => a.html), okrInitiativeAlerts.length));
        alertCount += okrInitiativeAlerts.length;
      }

      // 5. Réservations hôtel/train
      const userReservations = reservationAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userReservations.length > 0) {
        sections.push(sectionHtml("🚄", "Réservations à faire", COLORS.blue, userReservations.map((a) => a.html), userReservations.length));
        alertCount += userReservations.length;
      }

      // 2c. Missions sans date de début (filtered by assigned_to)
      const userMissionNoDateAlerts = missionNoDateAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userMissionNoDateAlerts.length > 0) {
        sections.push(sectionHtml("📅", "Missions sans date de début", COLORS.orange, userMissionNoDateAlerts.map((a) => a.html), userMissionNoDateAlerts.length));
        alertCount += userMissionNoDateAlerts.length;
      }

      // 3. Devis à faire (filtered by assigned_to)
      const userDevisAFaire = devisAFaireAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userDevisAFaire.length > 0) {
        sections.push(sectionHtml("📝", "Devis à faire", COLORS.blue, userDevisAFaire.map((a) => a.html), userDevisAFaire.length));
        alertCount += userDevisAFaire.length;
      }

      // 4. Devis à relancer (filtered by assigned_to)
      const userDevisRelance = devisRelanceAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userDevisRelance.length > 0) {
        sections.push(sectionHtml("🔄", "Devis à relancer", COLORS.orange, userDevisRelance.map((a) => a.html), userDevisRelance.length));
        alertCount += userDevisRelance.length;
      }

      // 5. Opportunités à contacter (filtered by assigned_to)
      const userOpportunites = opportunitesAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userOpportunites.length > 0) {
        const colName = firstColumn?.name || "Nouvelles";
        sections.push(sectionHtml("🎯", `Opportunités à contacter (${colName})`, COLORS.amber, userOpportunites.map((a) => a.html), userOpportunites.length));
        alertCount += userOpportunites.length;
      }

      // 6. Articles en relecture (column-based) — only show cards assigned to THIS recipient
      const userReviewCards = reviewCardsByEmail.get(recipient.email);
      if (userReviewCards && userReviewCards.length > 0) {
        const items = userReviewCards.map((card: any) => {
          const columnName = card.content_columns?.name || "";
          const daysAgo = Math.ceil((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return `<li><a href="${appUrl}/contenu?card=${card.id}" style="color: ${COLORS.primary}; text-decoration: underline;">${card.title}</a> — ${columnName} (${daysAgo}j)</li>`;
        });
        sections.push(sectionHtml("📋", "Articles en relecture", COLORS.purple, items, userReviewCards.length));
        alertCount += userReviewCards.length;
      }

      // 7. CFP à soumettre (filtered by assigned_to)
      const userCfpAlerts = cfpAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userCfpAlerts.length > 0) {
        sections.push(sectionHtml("📨", "CFP à soumettre", COLORS.orange, userCfpAlerts.map((a) => a.html), userCfpAlerts.length));
        alertCount += userCfpAlerts.length;
      }

      // 8. Formations à traiter (conventions)
      const userConvNotGen = conventionNotGenAlerts.filter(
        (a) => userCanSee(recipient, a.assignedTo)
      );
      const userConvNotSigned = conventionNotSignedAlerts.filter(
        (a) => userCanSee(recipient, a.assignedTo)
      );
      const formationItems = [
        ...userConvNotGen.map((a) => a.html),
        ...userConvNotSigned.map((a) => a.html),
      ];
      if (formationItems.length > 0) {
        sections.push(sectionHtml("🎓", "Formations à traiter", COLORS.red, formationItems, formationItems.length));
        alertCount += formationItems.length;
      }

      // 9. Événements approchant (filtered by assigned_to)
      const userEventAlerts = eventAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userEventAlerts.length > 0) {
        sections.push(sectionHtml("📅", "Événements approchant", COLORS.teal, userEventAlerts.map((a) => a.html), userEventAlerts.length));
        alertCount += userEventAlerts.length;
      }

      // 10. Rappels CFP année suivante (filtered by assigned_to)
      const userCfpReminders = cfpReminderAlerts.filter((a) => userCanSee(recipient, a.assignedTo));
      if (userCfpReminders.length > 0) {
        sections.push(sectionHtml("🔁", "CFP à surveiller (année suivante)", COLORS.blue, userCfpReminders.map((a) => a.html), userCfpReminders.length));
        alertCount += userCfpReminders.length;
      }

      // Skip if no alerts for this user
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
