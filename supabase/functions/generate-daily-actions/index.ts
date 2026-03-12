import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
  createErrorResponse,
} from "../_shared/mod.ts";

/**
 * Generate Daily Actions
 *
 * Called daily at 7:05 AM (after the digest email).
 * Creates action items in daily_actions table from the same data sources
 * as process-logistics-reminders. Idempotent: skips if actions already exist for today.
 */

const VERSION = "generate-daily-actions@1.0.0";

interface Recipient {
  userId: string;
  email: string;
  isAdmin: boolean;
}

interface ActionItem {
  category: string;
  title: string;
  description: string | null;
  link: string;
  entity_type: string;
  entity_id: string;
  assignedTo?: string | null;
}

serve(async (req) => {
  console.log(`[${VERSION}] Starting...`);

  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date(today);

    // Check if already generated today
    const { count } = await supabase
      .from("daily_actions")
      .select("id", { count: "exact", head: true })
      .eq("action_date", today);

    if (count && count > 0) {
      console.log(`[${VERSION}] Actions already generated for ${today}, skipping`);
      return createJsonResponse({ success: true, message: "Already generated", _version: VERSION });
    }

    // ── Fetch recipients ──
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

    const recipients: Recipient[] = (allProfiles || [])
      .filter((p: any) => p.is_admin || moduleUserIds.has(p.user_id))
      .map((p: any) => ({
        userId: p.user_id,
        email: p.email,
        isAdmin: p.is_admin === true,
      }));

    if (recipients.length === 0) {
      return createJsonResponse({ success: true, message: "No recipients", _version: VERSION });
    }

    // ══════════════════════════════════
    // Collect all action items (global)
    // ══════════════════════════════════

    const globalActions: ActionItem[] = [];
    const perUserActions: ActionItem[] = []; // actions with assignedTo

    // 0. E-LEARNING EN COURS AVEC GROUPE PRIVÉ (priorité haute, en tête)
    const { data: activeElearnings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, private_group_url, assigned_to")
      .in("format_formation", ["e_learning"])
      .not("private_group_url", "is", null)
      .lte("start_date", today);

    if (activeElearnings) {
      for (const t of activeElearnings) {
        // Only include if the training is still active (end_date is null or >= today)
        if (t.end_date && t.end_date < today) continue;
        if (!t.private_group_url?.trim()) continue;

        perUserActions.push({
          category: "elearning_groupe",
          title: `💬 ${t.training_name}`,
          description: "Répondre aux messages du groupe privé",
          link: t.private_group_url.trim(),
          entity_type: "training",
          entity_id: t.id,
          assignedTo: t.assigned_to,
        });
      }
      console.log(`[${VERSION}] E-learning groupes privés actifs: ${perUserActions.filter(a => a.category === "elearning_groupe").length}`);
    }

    // 1. MISSIONS À FACTURER (filtered by assigned_to)
    const { data: missionsToInvoice } = await supabase
      .from("missions")
      .select("id, title, client_name, consumed_amount, billed_amount, emoji, assigned_to, waiting_next_action_date")
      .in("status", ["in_progress", "completed"]);

    if (missionsToInvoice) {
      for (const m of missionsToInvoice) {
        const consumed = Number(m.consumed_amount) || 0;
        const billed = Number(m.billed_amount) || 0;
        if (consumed <= 0 || billed >= consumed) continue;
        // Skip missions with a future scheduled action
        if (m.waiting_next_action_date && m.waiting_next_action_date > today) continue;
        const remaining = consumed - billed;
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emoji = m.emoji ? `${m.emoji} ` : "";
        perUserActions.push({
          category: "missions_a_facturer",
          title: `${emoji}${label}`,
          description: `${remaining.toLocaleString("fr-FR")} € à facturer`,
          link: `${appUrl}/missions/${m.id}`,
          entity_type: "mission",
          entity_id: m.id,
          assignedTo: m.assigned_to,
        });
      }
    }
    console.log(`[${VERSION}] Missions à facturer: ${perUserActions.filter(a => a.category === "missions_a_facturer").length}`);

    // 1c. ACTIVITÉS MISSION NON FACTURÉES
    const { data: unbilledActivities } = await supabase
      .from("mission_activities")
      .select("id, mission_id, description, activity_date, billable_amount, duration, duration_type")
      .eq("is_billed", false)
      .gt("billable_amount", 0);

    if (unbilledActivities && unbilledActivities.length > 0) {
      // Group by mission_id
      const byMission = new Map<string, any[]>();
      for (const a of unbilledActivities) {
        const list = byMission.get(a.mission_id) || [];
        list.push(a);
        byMission.set(a.mission_id, list);
      }

      // Fetch mission info for these missions
      const missionIds = [...byMission.keys()];
      const { data: activityMissions } = await supabase
        .from("missions")
        .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date")
        .in("id", missionIds);

      if (activityMissions) {
        for (const m of activityMissions) {
          // Skip missions with a future scheduled action
          if (m.waiting_next_action_date && m.waiting_next_action_date > today) continue;
          const activities = byMission.get(m.id) || [];
          const totalUnbilled = activities.reduce((sum: number, a: any) => sum + (Number(a.billable_amount) || 0), 0);
          const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
          const emoji = m.emoji ? `${m.emoji} ` : "";
          perUserActions.push({
            category: "missions_activites_non_facturees",
            title: `${emoji}${label}`,
            description: `${activities.length} activité(s) non facturée(s) — ${totalUnbilled.toLocaleString("fr-FR")} €`,
            link: `${appUrl}/missions/${m.id}`,
            entity_type: "mission",
            entity_id: m.id,
            assignedTo: m.assigned_to,
          });
        }
      }
    }
    console.log(`[${VERSION}] Activités non facturées: ${perUserActions.filter(a => a.category === "missions_activites_non_facturees").length}`);

    // 1b. MISSIONS SANS DATE DE DÉBUT (filtered by assigned_to)
    const { data: missionsNoStartDate } = await supabase
      .from("missions")
      .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date")
      .in("status", ["not_started", "in_progress"])
      .is("start_date", null);

    if (missionsNoStartDate) {
      for (const m of missionsNoStartDate) {
        const label = m.client_name ? `${m.client_name} — ${m.title}` : m.title;
        const emoji = m.emoji ? `${m.emoji} ` : "";
        // Skip missions with a future scheduled action
        if (m.waiting_next_action_date && m.waiting_next_action_date > today) continue;
        perUserActions.push({
          category: "missions_sans_date",
          title: `${emoji}${label}`,
          description: "Date de début à définir",
          link: `${appUrl}/missions/${m.id}`,
          entity_type: "mission",
          entity_id: m.id,
          assignedTo: m.assigned_to,
        });
      }
    }
    console.log(`[${VERSION}] Missions sans date de début: ${perUserActions.filter(a => a.category === "missions_sans_date").length}`);

    // 2-4. CRM: Devis à faire, Opportunités, Devis à relancer
    const { data: crmColumns } = await supabase
      .from("crm_columns")
      .select("id, name, position")
      .eq("is_archived", false)
      .order("position", { ascending: true });

    const columns = crmColumns || [];
    const firstColumn = columns.length > 0 ? columns[0] : null;
    const contacteColumn = columns.find((c: any) => c.name.toLowerCase().includes("contact"));
    const devisEnvoyeColumn = columns.find((c: any) => c.name.toLowerCase().includes("devis envoy"));

    const targetColumnIds = new Set<string>();
    if (firstColumn) targetColumnIds.add(firstColumn.id);
    if (contacteColumn) targetColumnIds.add(contacteColumn.id);
    if (devisEnvoyeColumn) targetColumnIds.add(devisEnvoyeColumn.id);

    let crmCards: any[] = [];
    if (targetColumnIds.size > 0) {
      const { data: cards } = await supabase
        .from("crm_cards")
        .select("id, title, company, first_name, last_name, column_id, estimated_value, emoji, assigned_to, waiting_next_action_date, next_action_done")
        .eq("sales_status", "OPEN")
        .in("column_id", [...targetColumnIds]);
      // Filter: only cards with action due today or overdue (or no date = act now)
      crmCards = (cards || []).filter((c: any) => {
        if (c.next_action_done === true) return false;
        if (!c.waiting_next_action_date) return true; // no date = needs action now
        return c.waiting_next_action_date <= today; // due today or overdue
      });
    }

    const formatCrmCard = (card: any): { title: string; desc: string } => {
      const label = card.company ? `${card.company} — ${card.title}` : card.title;
      const emoji = card.emoji ? `${card.emoji} ` : "";
      const value = card.estimated_value && Number(card.estimated_value) > 0
        ? `${Number(card.estimated_value).toLocaleString("fr-FR")} €`
        : null;
      return { title: `${emoji}${label}`, desc: value || "" };
    };

    for (const card of crmCards) {
      let category = "";
      if (contacteColumn && card.column_id === contacteColumn.id) {
        category = "devis_a_faire";
      } else if (firstColumn && card.column_id === firstColumn.id && card.column_id !== contacteColumn?.id) {
        category = "opportunites";
      } else if (devisEnvoyeColumn && card.column_id === devisEnvoyeColumn.id) {
        category = "devis_a_relancer";
      }
      if (!category) continue;
      const { title, desc } = formatCrmCard(card);
      perUserActions.push({
        category,
        title,
        description: desc || null,
        link: `${appUrl}/crm`,
        entity_type: "crm_card",
        entity_id: card.id,
        assignedTo: card.assigned_to,
      });
    }

    // 5. FORMATIONS À TRAITER (conventions)
    const { data: allTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, format_formation, convention_file_url, signed_convention_urls, sponsor_email, assigned_to, is_cancelled")
      .gt("start_date", today)
      .or("is_cancelled.is.null,is_cancelled.eq.false");

    const trainings = allTrainings || [];
    const trainingIds = trainings.map((t) => t.id);

    const { data: allParticipants } = trainingIds.length > 0
      ? await supabase
          .from("training_participants")
          .select("id, training_id, first_name, last_name, email, convention_file_url, signed_convention_url, sponsor_email, payment_mode")
          .in("training_id", trainingIds)
      : { data: [] };

    const { data: allSignatures } = trainingIds.length > 0
      ? await supabase
          .from("convention_signatures")
          .select("training_id, recipient_email, status")
          .in("training_id", trainingIds)
      : { data: [] };

    const participantsByTraining = new Map<string, any[]>();
    for (const p of (allParticipants || [])) {
      const list = participantsByTraining.get(p.training_id) || [];
      list.push(p);
      participantsByTraining.set(p.training_id, list);
    }

    const signaturesByKey = new Map<string, string>();
    for (const sig of (allSignatures || [])) {
      signaturesByKey.set(`${sig.training_id}:${sig.recipient_email}`, sig.status);
    }

    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";
      const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

      // Convention non générée
      if (isIntra && !t.convention_file_url) {
        perUserActions.push({
          category: "formations_conventions",
          title: t.training_name,
          description: `Convention non générée (${trainingDate})`,
          link: `${appUrl}/formations/${t.id}`,
          entity_type: "training",
          entity_id: t.id,
          assignedTo: t.assigned_to,
        });
      } else if (isInterOrElearning) {
        const tParticipants = participantsByTraining.get(t.id) || [];
        const missing = tParticipants.filter((p: any) => !p.convention_file_url && p.payment_mode !== "online");
        if (missing.length > 0) {
          const names = missing.map((p: any) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email);
          perUserActions.push({
            category: "formations_conventions",
            title: t.training_name,
            description: `Convention non générée pour : ${names.join(", ")} (${trainingDate})`,
            link: `${appUrl}/formations/${t.id}`,
            entity_type: "training",
            entity_id: t.id,
            assignedTo: t.assigned_to,
          });
        }
      }

      // Convention non signée
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
            perUserActions.push({
              category: "formations_conventions",
              title: t.training_name,
              description: `${label} (${trainingDate})`,
              link: `${appUrl}/formations/${t.id}`,
              entity_type: "training",
              entity_id: t.id,
              assignedTo: t.assigned_to,
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
          perUserActions.push({
            category: "formations_conventions",
            title: t.training_name,
            description: `Convention non signée pour : ${unsignedNames.join(", ")} (${trainingDate})`,
            link: `${appUrl}/formations/${t.id}`,
            entity_type: "training",
            entity_id: t.id,
            assignedTo: t.assigned_to,
          });
        }
      }
    }

    // 6. ARTICLES À RELIRE (exclude cards in "terminé" column)
    const { data: pendingReviews } = await supabase
      .from("content_reviews")
      .select("id, card_id, reviewer_email, status, content_cards(title, column_id, content_columns:column_id(name))")
      .in("status", ["pending", "in_review"]);

    if (pendingReviews) {
      for (const r of pendingReviews) {
        const card = (r as any).content_cards;
        const columnName = card?.content_columns?.name?.toLowerCase() || "";
        // Skip cards in "terminé" or "publié" columns
        if (columnName.includes("termin") || columnName.includes("publi")) continue;

        const cardTitle = card?.title || "Sans titre";
        const statusLabel = r.status === "in_review" ? "Relecture en cours" : "En attente de relecture";
        globalActions.push({
          category: "articles_relire",
          title: cardTitle,
          description: `${statusLabel} (${r.reviewer_email})`,
          link: `${appUrl}/contenu?card=${r.card_id}`,
          entity_type: "content_review",
          entity_id: r.id,
        });
      }
    }

    // 6bis. COMMENTAIRES CONTENUS NON RÉSOLUS (pour auteurs et utilisateurs mentionnés)
    const { data: unresolvedComments } = await supabase
      .from("review_comments")
      .select("id, card_id, author_id, content, mentioned_user_ids, assigned_to, content_cards:card_id(title, column_id, content_columns:column_id(name))")
      .eq("status", "pending")
      .is("parent_comment_id", null);

    if (unresolvedComments) {
      for (const c of unresolvedComments as any[]) {
        const card = c.content_cards;
        const columnName = card?.content_columns?.name?.toLowerCase() || "";
        if (columnName.includes("termin") || columnName.includes("publi")) continue;

        const cardTitle = card?.title || "Sans titre";
        const preview = c.content?.length > 60 ? c.content.slice(0, 60) + "…" : c.content;

        // Collect target users: author + mentioned + assigned
        const targetUserIds = new Set<string>();
        if (c.author_id) targetUserIds.add(c.author_id);
        if (c.assigned_to) targetUserIds.add(c.assigned_to);
        if (c.mentioned_user_ids && Array.isArray(c.mentioned_user_ids)) {
          for (const uid of c.mentioned_user_ids) targetUserIds.add(uid);
        }

        for (const uid of targetUserIds) {
          perUserActions.push({
            category: "commentaires_contenu",
            title: `💬 ${cardTitle}`,
            description: `Commentaire non résolu : ${preview}`,
            link: `${appUrl}/contenu?card=${c.card_id}`,
            entity_type: "review_comment",
            entity_id: c.id,
            assignedTo: uid,
          });
        }
      }
      console.log(`[${VERSION}] Commentaires contenus non résolus: ${unresolvedComments.length}`);
    }

    // 6b. ARTICLES BLOQUÉS (cards in waiting/blocked columns, no review filter)
    const { data: blockedCards } = await supabase
      .from("content_cards")
      .select("id, title, column_id, content_columns:column_id(name)")
      .not("column_id", "is", null);

    if (blockedCards) {
      for (const card of blockedCards) {
        const columnName = ((card as any).content_columns?.name || "").toLowerCase();
        if (columnName.includes("bloqu") || columnName.includes("attente")) {
          globalActions.push({
            category: "articles_bloques",
            title: card.title,
            description: `Colonne : ${(card as any).content_columns?.name}`,
            link: `${appUrl}/contenu?card=${card.id}`,
            entity_type: "content_card",
            entity_id: card.id,
          });
        }
      }
    }

    // 7. ÉVÉNEMENTS APPROCHANT (< 15 jours)
    const fifteenDays = new Date(todayDate);
    fifteenDays.setDate(fifteenDays.getDate() + 15);
    const maxEventDate = fifteenDays.toISOString().split("T")[0];

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, location, assigned_to")
      .gte("event_date", today)
      .lte("event_date", maxEventDate)
      .eq("status", "active")
      .order("event_date", { ascending: true });

    if (upcomingEvents) {
      for (const ev of upcomingEvents) {
        const daysUntil = Math.ceil((new Date(ev.event_date).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventDate = new Date(ev.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const daysLabel = daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `J-${daysUntil}`;
        perUserActions.push({
          category: "evenements",
          title: ev.title,
          description: `${eventDate}${ev.location ? ` — ${ev.location}` : ""} (${daysLabel})`,
          link: `${appUrl}/events/${ev.id}`,
          entity_type: "event",
          entity_id: ev.id,
          assignedTo: ev.assigned_to,
        });
      }
    }

    // 8. CFP À SOUMETTRE (< 30 jours)
    const thirtyDays = new Date(todayDate);
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const maxCfpDate = thirtyDays.toISOString().split("T")[0];

    const { data: cfpEvents } = await supabase
      .from("events")
      .select("id, title, cfp_deadline, assigned_to")
      .eq("event_type", "external")
      .eq("status", "active")
      .not("cfp_deadline", "is", null)
      .gte("cfp_deadline", today)
      .lte("cfp_deadline", maxCfpDate)
      .order("cfp_deadline", { ascending: true });

    if (cfpEvents) {
      for (const ev of cfpEvents) {
        const daysUntil = Math.ceil((new Date(ev.cfp_deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        const deadlineDate = new Date(ev.cfp_deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        perUserActions.push({
          category: "cfp_soumettre",
          title: ev.title,
          description: `Deadline CFP : ${deadlineDate} (J-${daysUntil})`,
          link: `${appUrl}/events/${ev.id}`,
          entity_type: "event",
          entity_id: ev.id,
          assignedTo: ev.assigned_to,
        });
      }
    }

    // 9. CFP ANNÉE SUIVANTE
    const tenMonthsAgo = new Date(todayDate);
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
    const tenMonthsAgoStr = tenMonthsAgo.toISOString().split("T")[0];
    const tenMonthsAgoMinus7 = new Date(tenMonthsAgo);
    tenMonthsAgoMinus7.setDate(tenMonthsAgoMinus7.getDate() - 7);
    const tenMonthsAgoMinus7Str = tenMonthsAgoMinus7.toISOString().split("T")[0];

    const { data: cfpReminderEvents } = await supabase
      .from("events")
      .select("id, title, cfp_deadline, assigned_to")
      .eq("event_type", "external")
      .not("cfp_deadline", "is", null)
      .gte("cfp_deadline", tenMonthsAgoMinus7Str)
      .lte("cfp_deadline", tenMonthsAgoStr);

    if (cfpReminderEvents) {
      for (const ev of cfpReminderEvents) {
        perUserActions.push({
          category: "cfp_surveiller",
          title: ev.title,
          description: "Vérifier le CFP de cette année",
          link: `${appUrl}/events/${ev.id}`,
          entity_type: "event",
          entity_id: ev.id,
          assignedTo: ev.assigned_to,
        });
      }
    }

    // 10. FORMATIONS TERMINÉES SANS FACTURE
    // Exclude trainings where ALL participants paid online (no invoice needed)
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

      let participantsByTrainingInvoice = new Map<string, any[]>();
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

        // Check if all participants paid online — no invoice needed
        const participants = participantsByTrainingInvoice.get(t.id) || [];
        if (participants.length > 0) {
          const allPaidOnline = participants.every((p: any) => p.payment_mode === "online");
          if (allPaidOnline) continue;

          // For inter/e-learning: check if all invoice-mode participants already have their invoice
          const isInterOrElearning = ["inter-entreprises", "e_learning"].includes(t.format_formation);
          if (isInterOrElearning) {
            const invoiceParticipants = participants.filter((p: any) => p.payment_mode !== "online");
            const allInvoiced = invoiceParticipants.length > 0 && invoiceParticipants.every((p: any) => p.invoice_file_url);
            if (allInvoiced) continue;
          }
        }

        const daysAgo = Math.ceil((Date.now() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
        const formattedDate = new Date(endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        perUserActions.push({
          category: "formations_facture",
          title: t.training_name,
          description: `Terminée le ${formattedDate} (il y a ${daysAgo}j)`,
          link: `${appUrl}/formations/${t.id}`,
          entity_type: "training",
          entity_id: t.id,
          assignedTo: t.assigned_to,
        });
      }
    }

    // 11. OKR INITIATIVES ACTIVES
    const { data: activeInitiatives } = await supabase
      .from("okr_initiatives")
      .select("id, title, progress_percentage, key_result_id, status")
      .in("status", ["active", "draft"]);

    if (activeInitiatives && activeInitiatives.length > 0) {
      // Get parent key results + objectives for context
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
        if (!obj) continue; // Only include initiatives from active objectives

        globalActions.push({
          category: "okr_initiatives",
          title: init.title,
          description: `${obj.title} → ${kr.title} (${init.progress_percentage}%)`,
          link: `${appUrl}/okr`,
          entity_type: "okr_initiative",
          entity_id: init.id,
        });
      }
      console.log(`[${VERSION}] OKR initiatives actives: ${activeInitiatives.length}`);
    }

    // 12. RAPPELS RÉSERVATION (J-60, rappel quotidien tant que non coché)
    const sixtyDaysLater = new Date(todayDate);
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
    const sixtyDaysStr = sixtyDaysLater.toISOString().split("T")[0];

    // 12a. Missions
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

        perUserActions.push({
          category: "reservations_mission",
          title: `${m.emoji || "📋"} ${m.title}`,
          description: `${items.join(" + ")} à réserver — ${m.location} (${startFormatted})`,
          link: `${appUrl}/missions/${m.id}`,
          entity_type: "mission",
          entity_id: m.id,
          assignedTo: m.assigned_to,
        });
      }
      console.log(`[${VERSION}] Missions nécessitant réservation: ${missionsNeedingBooking.filter((m: any) => (!m.train_booked || !m.hotel_booked) && m.location).length}`);
    }

    // 12b. Formations (train, hôtel, restaurant, salle, matériel)
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

        perUserActions.push({
          category: "reservations_formation",
          title: `🎓 ${t.training_name}`,
          description: `${items.join(" + ")} à réserver — ${hasLocation ? t.location + " " : ""}(${startFormatted})`,
          link: `${appUrl}/formations/${t.id}`,
          entity_type: "training",
          entity_id: t.id,
          assignedTo: t.assigned_to,
        });
      }
      console.log(`[${VERSION}] Formations nécessitant réservation: ${trainingsNeedingBooking.filter((t: any) => !t.train_booked || !t.hotel_booked || !t.restaurant_booked || !t.room_rental_booked || !t.equipment_ready).length}`);
    }

    // 12c. Événements internes en physique
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

        perUserActions.push({
          category: "reservations_evenement",
          title: `📅 ${ev.title}`,
          description: `${items.join(" + ")} à réserver — ${ev.location} (${eventDateFormatted})`,
          link: `${appUrl}/events/${ev.id}`,
          entity_type: "event",
          entity_id: ev.id,
          assignedTo: ev.assigned_to,
        });
      }
      console.log(`[${VERSION}] Événements nécessitant réservation: ${eventsNeedingBooking.filter((ev: any) => !ev.train_booked || !ev.hotel_booked || !ev.room_rental_booked || !ev.restaurant_booked).length}`);
    }

    // ══════════════════════════════════
    // Insert actions per user
    // ══════════════════════════════════
    let totalInserted = 0;

    for (const recipient of recipients) {
      const userActions: any[] = [];

      // Global actions: visible to all
      for (const action of globalActions) {
        userActions.push({
          user_id: recipient.userId,
          action_date: today,
          category: action.category,
          title: action.title,
          description: action.description,
          link: action.link,
          entity_type: action.entity_type,
          entity_id: action.entity_id,
        });
      }

      // Per-user actions: only if admin or assigned (unassigned items only visible to admins)
      for (const action of perUserActions) {
        if (!recipient.isAdmin && (!action.assignedTo || action.assignedTo !== recipient.userId)) continue;
        userActions.push({
          user_id: recipient.userId,
          action_date: today,
          category: action.category,
          title: action.title,
          description: action.description,
          link: action.link,
          entity_type: action.entity_type,
          entity_id: action.entity_id,
        });
      }

      if (userActions.length === 0) continue;

      const { error } = await supabase
        .from("daily_actions")
        .upsert(userActions, { onConflict: "user_id,action_date,category,entity_type,entity_id" });

      if (error) {
        console.error(`[${VERSION}] Error inserting for ${recipient.email}:`, error.message);
      } else {
        totalInserted += userActions.length;
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
