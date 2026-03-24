import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
  createErrorResponse,
} from "../_shared/mod.ts";
import { skipIfNonWorkingDay } from "../_shared/working-days.ts";
import {
  fetchAllDailyData,
  userCanSee,
  REVIEW_COLUMN_ASSIGNMENTS,
  type Recipient,
} from "../_shared/daily-data-fetchers.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

/**
 * Generate Daily Actions
 *
 * Called daily at 7:05 AM (after the digest email).
 * Creates action items in daily_actions table.
 *
 * Data fetching is shared with process-logistics-reminders via _shared/daily-data-fetchers.ts.
 */

const VERSION = "generate-daily-actions@2.0.0";

interface ActionRow {
  user_id: string;
  action_date: string;
  category: string;
  title: string;
  description: string | null;
  link: string;
  entity_type: string;
  entity_id: string;
}

serve(async (req) => {
  console.log(`[${VERSION}] Starting...`);

  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
    const supabase = getSupabaseClient();

    // Skip on non-working days (weekends by default, configurable in app_settings)
    const skip = await skipIfNonWorkingDay(supabase, VERSION);
    if (skip) return skip;

    const today = new Date().toISOString().split("T")[0];

    // ── Fetch all data using shared fetchers ──
    const data = await fetchAllDailyData(supabase, today);
    const { recipients } = data;

    if (recipients.length === 0) {
      return createJsonResponse({ success: true, message: "No recipients", _version: VERSION });
    }

    console.log(`[${VERSION}] ${recipients.length} recipients, building actions...`);

    // ── Build per-user and global action lists ──
    // "global" = visible to all users
    // "perUser" = filtered by assignedTo
    // "strictAssigned" = only visible to the assigned user (not even admins see others')
    interface ActionDef {
      category: string;
      title: string;
      description: string | null;
      link: string;
      entityType: string;
      entityId: string;
      assignedTo?: string | null;
      scope: "global" | "perUser" | "strictAssigned";
    }

    const actions: ActionDef[] = [];

    // 0. Missions — Actions à traiter
    for (const m of data.missionActions) {
      const label = m.clientName ? `${m.clientName} — ${m.title}` : m.title;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      const dateLabel = m.actionDate === today
        ? "Aujourd'hui"
        : `En retard (${new Date(m.actionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})`;
      actions.push({
        category: "missions_actions",
        title: `${emoji}${label}`,
        description: `${m.actionText}${m.isOverdue ? ` — ⚠️ ${dateLabel}` : ""}`,
        link: `${appUrl}/missions/${m.id}`,
        entityType: "mission", entityId: m.id,
        assignedTo: m.assignedTo, scope: "perUser",
      });
    }

    // 0b. E-learning groupes privés
    for (const t of data.elearningGroups) {
      actions.push({
        category: "elearning_groupe",
        title: `💬 ${t.trainingName}`,
        description: "Répondre aux messages du groupe privé",
        link: t.privateGroupUrl,
        entityType: "training", entityId: t.id,
        assignedTo: t.assignedTo, scope: "perUser",
      });
    }

    // 1. Missions à facturer
    for (const m of data.missionsToInvoice) {
      const label = m.clientName ? `${m.clientName} — ${m.title}` : m.title;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      actions.push({
        category: "missions_a_facturer",
        title: `${emoji}${label}`,
        description: `${m.remaining.toLocaleString("fr-FR")} € à facturer`,
        link: `${appUrl}/missions/${m.id}`,
        entityType: "mission", entityId: m.id,
        assignedTo: m.assignedTo, scope: "perUser",
      });
    }

    // 1c. Activités non facturées
    for (const m of data.unbilledActivities) {
      const label = m.clientName ? `${m.clientName} — ${m.title}` : m.title;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      actions.push({
        category: "missions_activites_non_facturees",
        title: `${emoji}${label}`,
        description: `${m.activityCount} activité(s) non facturée(s) — ${m.totalUnbilled.toLocaleString("fr-FR")} €`,
        link: `${appUrl}/missions/${m.missionId}`,
        entityType: "mission", entityId: m.missionId,
        assignedTo: m.assignedTo, scope: "perUser",
      });
    }

    // 1b. Missions sans date
    for (const m of data.missionsNoStartDate) {
      const label = m.clientName ? `${m.clientName} — ${m.title}` : m.title;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      actions.push({
        category: "missions_sans_date",
        title: `${emoji}${label}`,
        description: "Date de début à définir",
        link: `${appUrl}/missions/${m.id}`,
        entityType: "mission", entityId: m.id,
        assignedTo: m.assignedTo, scope: "perUser",
      });
    }

    // 2-4. CRM cards
    for (const card of data.crmCards) {
      const label = card.company ? `${card.company} — ${card.title}` : card.title;
      const emoji = card.emoji ? `${card.emoji} ` : "";
      const value = card.estimatedValue && card.estimatedValue > 0
        ? `${card.estimatedValue.toLocaleString("fr-FR")} €` : null;
      actions.push({
        category: card.category,
        title: `${emoji}${label}`,
        description: value,
        link: `${appUrl}/crm`,
        entityType: "crm_card", entityId: card.id,
        assignedTo: card.assignedTo, scope: "perUser",
      });
    }

    // 5. Training conventions
    for (const t of data.trainingConventions) {
      const dateStr = new Date(t.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      const issueLabels: Record<string, string> = {
        not_generated: "Convention non générée",
        not_signed: "Convention non signée",
        pending_signature: "Signature électronique en attente",
      };
      const label = issueLabels[t.issue];
      const names = t.participantNames?.length ? ` pour : ${t.participantNames.join(", ")}` : "";
      actions.push({
        category: "formations_conventions",
        title: t.trainingName,
        description: `${label}${names} (${dateStr})`,
        link: `${appUrl}/formations/${t.trainingId}`,
        entityType: "training", entityId: t.trainingId,
        assignedTo: t.assignedTo, scope: "perUser",
      });
    }

    // 6. Articles en relecture (strictAssigned)
    for (const card of data.reviewArticles) {
      actions.push({
        category: "articles_relire",
        title: card.title,
        description: `En relecture — ${card.columnName}`,
        link: `${appUrl}/contenu?card=${card.id}`,
        entityType: "content_card", entityId: card.id,
        assignedTo: card.assignedUserId, scope: "strictAssigned",
      });
    }

    // 6bis. Commentaires non résolus — groupés par article (strictAssigned, one per target user)
    for (const c of data.unresolvedComments) {
      for (const uid of c.targetUserIds) {
        actions.push({
          category: "commentaires_contenu",
          title: `💬 ${c.cardTitle}`,
          description: `${c.commentCount} commentaire${c.commentCount > 1 ? "s" : ""} non résolu${c.commentCount > 1 ? "s" : ""}`,
          link: `${appUrl}/contenu?card=${c.cardId}`,
          entityType: "card_comments", entityId: c.cardId,
          assignedTo: uid, scope: "strictAssigned",
        });
      }
    }

    // 6b. Articles bloqués (global)
    for (const card of data.blockedArticles) {
      actions.push({
        category: "articles_bloques",
        title: card.title,
        description: `Colonne : ${card.columnName}`,
        link: `${appUrl}/contenu?card=${card.id}`,
        entityType: "content_card", entityId: card.id,
        scope: "global",
      });
    }

    // 7. Événements approchant
    for (const ev of data.upcomingEvents) {
      const eventDate = new Date(ev.eventDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      const daysLabel = ev.daysUntil === 0 ? "Aujourd'hui" : ev.daysUntil === 1 ? "Demain" : `J-${ev.daysUntil}`;
      actions.push({
        category: "evenements",
        title: ev.title,
        description: `${eventDate}${ev.location ? ` — ${ev.location}` : ""} (${daysLabel})`,
        link: `${appUrl}/events/${ev.id}`,
        entityType: "event", entityId: ev.id,
        assignedTo: ev.assignedTo, scope: "perUser",
      });
    }

    // 8. CFP à soumettre
    for (const ev of data.cfpAlerts) {
      const deadlineDate = new Date(ev.cfpDeadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      actions.push({
        category: "cfp_soumettre",
        title: ev.title,
        description: `Deadline CFP : ${deadlineDate} (J-${ev.daysUntil})`,
        link: `${appUrl}/events/${ev.id}`,
        entityType: "event", entityId: ev.id,
        assignedTo: ev.assignedTo, scope: "perUser",
      });
    }

    // 9. CFP année suivante
    for (const ev of data.cfpReminders) {
      actions.push({
        category: "cfp_surveiller",
        title: ev.title,
        description: "Vérifier le CFP de cette année",
        link: `${appUrl}/events/${ev.id}`,
        entityType: "event", entityId: ev.id,
        assignedTo: ev.assignedTo, scope: "perUser",
      });
    }

    // 10. Formations sans facture
    for (const t of data.pastTrainingsNoInvoice) {
      const formattedDate = new Date(t.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      actions.push({
        category: "formations_facture",
        title: t.trainingName,
        description: `Terminée le ${formattedDate} (il y a ${t.daysAgo}j)`,
        link: `${appUrl}/formations/${t.trainingId}`,
        entityType: "training", entityId: t.trainingId,
        assignedTo: t.assignedTo, scope: "perUser",
      });
    }

    // 11. OKR Initiatives (global)
    for (const init of data.okrInitiatives) {
      actions.push({
        category: "okr_initiatives",
        title: init.title,
        description: `${init.objectiveTitle} → ${init.keyResultTitle} (${init.progressPercentage}%)`,
        link: `${appUrl}/okr`,
        entityType: "okr_initiative", entityId: init.id,
        scope: "global",
      });
    }

    // 12. Réservations
    for (const r of data.reservations) {
      const items: string[] = [];
      if (r.needsTrain) items.push("🚄 Train");
      if (r.needsHotel) items.push("🏨 Hôtel");
      if (r.needsRestaurant) items.push("🍽️ Restaurant");
      if (r.needsRoom) items.push("🚪 Salle");
      if (r.needsEquipment) items.push("📦 Matériel");
      const startFormatted = new Date(r.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      const pathMap = { mission: "missions", training: "formations", event: "events" };
      const categoryMap = { mission: "reservations_mission", training: "reservations_formation", event: "reservations_evenement" };
      actions.push({
        category: categoryMap[r.entityType],
        title: `${r.emoji || "📋"} ${r.title}`,
        description: `${items.join(" + ")} à réserver — ${r.location} (${startFormatted})`,
        link: `${appUrl}/${pathMap[r.entityType]}/${r.entityId}`,
        entityType: r.entityType, entityId: r.entityId,
        assignedTo: r.assignedTo, scope: "perUser",
      });
    }

    // ── Delete + insert per user ──
    const STRICT_ASSIGNED_CATEGORIES = ["articles_relire", "commentaires_contenu"];

    for (const recipient of recipients) {
      // Delete non-completed actions (will be regenerated)
      await supabase
        .from("daily_actions")
        .delete()
        .eq("user_id", recipient.userId)
        .eq("action_date", today)
        .eq("is_completed", false);

      // Delete completed strict-assigned actions (may have been reassigned)
      await supabase
        .from("daily_actions")
        .delete()
        .eq("user_id", recipient.userId)
        .eq("action_date", today)
        .in("category", STRICT_ASSIGNED_CATEGORIES)
        .eq("is_completed", true);
    }

    let totalInserted = 0;

    for (const recipient of recipients) {
      const userActions: ActionRow[] = [];

      for (const action of actions) {
        let visible = false;
        if (action.scope === "global") {
          visible = true;
        } else if (action.scope === "strictAssigned") {
          visible = action.assignedTo === recipient.userId;
        } else {
          // perUser: admin sees all, non-admin only sees assigned
          visible = userCanSee(recipient, action.assignedTo ?? null);
        }
        if (!visible) continue;

        userActions.push({
          user_id: recipient.userId,
          action_date: today,
          category: action.category,
          title: action.title,
          description: action.description,
          link: action.link,
          entity_type: action.entityType,
          entity_id: action.entityId,
        });
      }

      if (userActions.length === 0) continue;

      // Deduplicate
      const seen = new Set<string>();
      const deduped = userActions.filter(a => {
        const key = `${a.category}|${a.entity_type}|${a.entity_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const { error } = await supabase
        .from("daily_actions")
        .upsert(deduped, { onConflict: "user_id,action_date,category,entity_type,entity_id" });

      if (error) {
        console.error(`[${VERSION}] Error inserting for user ${recipient.userId}:`, error.message);
      } else {
        totalInserted += deduped.length;
      }
    }

    console.log(`[${VERSION}] Done: ${totalInserted} actions for ${recipients.length} users`);

    return createJsonResponse({
      success: true,
      recipientCount: recipients.length,
      totalActions: totalInserted,
      _version: VERSION,
    });
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg);
  }
});
